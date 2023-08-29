'use strict'

/**
 * @see https://docs.strapi.io/dev-docs/backend-customization/models#declarative-and-programmatic-usage
 */
module.exports = ({ strapi }) => {
  strapi.log.debug(`[plugin::aws-cloudfront] AWS CloudFront plugin starting..`)

  if (!strapi.config.get('plugin.aws-cloudfront.client.distributionId')) {
    strapi.log.warn(`[plugin::aws-cloudfront] CloudFront Distribution Id not defined. Dry run mode is activated.`)
  }
  if (strapi.config.get('plugin.aws-cloudfront.bulk', true)) {
    strapi.plugin('aws-cloudfront').service('cloudfront').initBulk()
  } else {
    strapi.log.info(
      `[plugin::aws-cloudfront] Bulk option is not activated ! It is recommended to activate it to send multiple invalidations in a grouped request. Prefer to update the bulkTimeout option instead.`
    )
  }

  strapi.db.lifecycles.subscribe(async (event) => {
    const contentType = event.model.singularName
    if (!strapi.plugin('aws-cloudfront').service('cloudfront').availableContentTypes.includes(contentType)) {
      return
    }

    if (['beforeUpdate', 'beforeUpdateMany', 'beforeDelete', 'beforeDeleteMany'].includes(event.action)) {
      const entries = await strapi.query(event.model.uid).findMany({ where: event.params.where })
      for (const entry of entries) {
        const isPublished = entry?.publishedAt !== null // undefined for draftAndPublish=false or value if published
        if (isPublished) {
          strapi.plugin('aws-cloudfront').service('cloudfront').invalidateByEntry(contentType, entry)
          event.state[entry.id] = {
            wasPublished: true,
          }
        }
      }
    } else if (['afterUpdate', 'afterUpdateMany'].includes(event.action)) {
      const entries = event?.result?.id
        ? [event.result]
        : await strapi.query(event.model.uid).findMany({ where: event.params.where })
      for (const entry of entries) {
        const isPublished = entry?.publishedAt !== null // undefined for draftAndPublish=false or value if published
        const wasPublished = event.state?.[entry.id]?.wasPublished
        if (isPublished && wasPublished) {
          strapi.plugin('aws-cloudfront').service('cloudfront').invalidateByEntry(contentType, entry)
        }
      }
    }
  })

  strapi.log.debug(`[plugin::aws-cloudfront] AWS CloudFront plugin started`)
}
