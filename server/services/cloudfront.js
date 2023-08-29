'use strict'

/**
 * @see https://lodash.com/docs/4.17.15
 */
const _ = require('lodash')

/**
 * @see https://github.com/mcollina/retimer#readme
 */
const retimer = require('retimer')

const {
  CloudFrontClient,
  CreateInvalidationCommand,
  CreateInvalidationCommandInput,
} = require('@aws-sdk/client-cloudfront')

const DEFAULT_OPTION_BULK_TIMEOUT = 500 // milliseconds

const client = new CloudFrontClient()
let scheduledPathToInvalidate = []
let scheduler = null

module.exports = ({ strapi }) => ({
  /**
   * Init the bulk mode (called by the boostrap.js of this plugin)
   *
   * @private
   */
  initBulk() {
    if (!scheduler) {
      scheduler = retimer(() => {
        scheduler.clear()
        if (scheduledPathToInvalidate.length) {
          this.invalidateBatchNow(_.clone(_.uniq(scheduledPathToInvalidate)))
          scheduledPathToInvalidate = []
        }
      }, this.schedulerTimeout)
    }
  },

  /**
   * @returns {string[]}
   */
  get availableContentTypes() {
    return Object.keys(strapi.config.get('plugin.aws-cloudfront.contentTypes', {}))
  },

  /**
   * @return {boolean}
   */
  get isDryRun() {
    return !strapi.config.get('plugin.aws-cloudfront.client.distributionId')
  },

  /**
   * @return {boolean}
   */
  get isBulkActivated() {
    return strapi.config.get('plugin.aws-cloudfront.bulk', true) && scheduler !== null
  },

  /**
   * @return {number} Timeout in milliseconds
   */
  get schedulerTimeout() {
    return strapi.config.get('plugin.aws-cloudfront.bulkTimeout', DEFAULT_OPTION_BULK_TIMEOUT)
  },

  /**
   * Get the list of path for a content type
   * @see ~/config/plugin.js to check the configuration for this content type
   *
   * @param {string} contentType
   * @param entry
   * @returns {string[]}
   */
  getAffectedPathList(contentType, entry) {
    // Get plugin config
    const globalConfig = strapi.config.get('plugin.aws-cloudfront')

    // Get plugin config for content type
    const contentTypeConfig = globalConfig?.contentTypes?.[contentType]
    if (!contentTypeConfig) {
      return []
    }
    const { defaultLocale, prefixDefaultLocale, prefixLocalization, noTrailingSlash } = {
      ...(globalConfig.defaultConfig || {}),
      ...contentTypeConfig,
    }

    // Prepare base uri with locale
    let baseUri = ''
    const { locale } = entry
    if (prefixLocalization && (prefixDefaultLocale || locale !== defaultLocale)) {
      baseUri += `/${locale}`
    }

    // List path to invalidate
    let pathListToInvalidate = []
    for (const path of [contentTypeConfig.path, contentTypeConfig.localizedPath?.[locale]]) {
      if (!path) {
        continue
      }
      if (Array.isArray(path)) {
        pathListToInvalidate = pathListToInvalidate.concat(path)
      } else {
        pathListToInvalidate.push(path)
      }
    }

    // Schedule path to invalidate
    const uriList = []
    for (const path of pathListToInvalidate) {
      if (typeof path !== 'string' || !path.startsWith('/')) {
        strapi.log.warn(`[plugin.aws-cloudfront] Invalid config for ${contentType}: (${typeof path}) "${path}"`)
        continue
      }
      let uri = baseUri + eval('`' + path.replace(/:([^/*?]+)/, '${entry.$1}') + '`')
      if (noTrailingSlash) {
        uri = uri.replace(/\/$/, '')
      }
      uriList.push(uri)
    }

    return uriList
  },

  /**
   * Invalidate an entry in terms of the content type
   * @see ~/config/plugin.js to check the configuration for this content type
   *
   * @param {string} contentType
   * @param entry
   * @returns {string[]}
   */
  async invalidateByEntry(contentType, entry) {
    const pathList = this.getAffectedPathList(contentType, entry)
    await this.invalidateBatch(pathList)
    return pathList
  },

  /**
   * Invalidate a list of path
   *
   * @param {string[]} pathList
   * @return {Promise<*>}
   */
  invalidateBatch(pathList) {
    if (this.isBulkActivated) {
      scheduledPathToInvalidate = scheduledPathToInvalidate.concat(pathList)
      scheduler.reschedule(this.schedulerTimeout)
    } else {
      return this.invalidateBatchNow(pathList)
    }
  },

  /**
   * Invalidate a single path
   *
   * @param {string} path
   * @return {Promise<*>}
   */
  invalidate(path) {
    return this.invalidateBatch([path])
  },

  /**
   * Invalidate list of path now.
   * Important : bulk is not applied with this function ! Prefer to use invalidateBatch instead !
   *
   * @param {string[]} pathList
   * @return {Promise<*>}
   */
  async invalidateBatchNow(pathList) {
    strapi.log.debug(
      `[plugin::aws-cloudfront]${this.isDryRun ? ' DRY RUN -' : ''} Invalidate:${['', ...pathList].join('\n  - ')}`
    )
    if (this.isDryRun) {
      return
    }
    /**
     * @type {CreateInvalidationCommandInput}
     */
    const input = {
      DistributionId: strapi.config.get('plugin.aws-cloudfront.client.distributionId'),
      InvalidationBatch: {
        Paths: {
          Quantity: pathList.length,
          Items: pathList,
        },
        CallerReference: Date.now().toString(),
      },
    }
    const command = new CreateInvalidationCommand(input)
    return client.send(command)
  },
})
