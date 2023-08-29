# Strapi plugin aws-cloudfront

## 🔗 Links

- Strapi
  - [Strapi website](https://strapi.io/)
  - [Strapi documentation](https://docs.strapi.io)
    - [Create a Strapi plugin](https://docs.strapi.io/dev-docs/plugins-development)
    - [Strapi lifecycle hooks](https://docs.strapi.io/dev-docs/backend-customization/models#lifecycle-hooks)
  - [Strapi community on Discord](https://discord.strapi.io)
  - [Strapi news on Twitter](https://twitter.com/strapijs)
- [AWS CloudFront SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/cloudfront/)

## ⚙️ Versions

Tested with **Strapi v4** (current)

## ⏳ Installation

### Via Strapi Markerplace

As a ✅ **verified** plugin by Strapi team we're available on the [**Strapi Marketplace**](https://market.strapi.io/plugins/strapi-plugin-aws-cloudfront) as well as **In-App Marketplace** where you can follow the installation instructions.

### Via command line

It's recommended to use **yarn** to install this plugin within your Strapi project. [You can install yarn with these docs](https://yarnpkg.com/lang/en/docs/install/).

```bash
yarn add strapi-plugin-aws-cloudfront@latest
```

After successful installation you've to re-build your Strapi instance. To archive that simply use:

```bash
yarn build
yarn develop
```

or just run Strapi in the development mode with `--watch-admin` option:

```bash
yarn develop --watch-admin
```

## 🔧 Configuration

`./config/plugins.js` or `./config/plugins.ts` for TypeScript projects:

| Option                                                       | Default | Description                                                                             |
|--------------------------------------------------------------|---------|-----------------------------------------------------------------------------------------|
| `client`                                                     | {}      |                                                                                         | 
| `client.distributionId`                                      |         | The distribution id to connect to the CloudFront                                        |
| `bulk`                                                       | true    | Activate or not bulk mode (recommended)                                                 |
| `bulkTimeout`                                                | 500     | Timeout for the bulk mode (in milliseconds)                                             |
| `defaultConfig`                                              | {}      |                                                                                         |
| `defaultConfig.defaultLocale`                                |         | Set the default local                                                                   |
| `defaultConfig.prefixDefaultLocale`                          |         | Prefix the path with the default locale (only if `prefixLocalization` is set to `true`) |
| `defaultConfig.prefixLocalization`                           |         | Prefix the path with the locale (except default locale)                                 |
| `defaultConfig.noTrailingSlash`                              |         | Remove the trailing slash at the end of the url                                         |
| `contentTypes`                                               | {}      |                                                                                         |
| `contentTypes.<my-content-type-name>.path`                   | []      | List of path to invalidate                                                              |
| `contentTypes.<my-content-type-name>.localizedPath`          | {}      | See below                                                                               |
| `contentTypes.<my-content-type-name>.localizedPath.<locale>` | []      | List of path to invalidate                                                              |

### Example

```js
module.exports = ({ env }) => ({
  // ...
  'aws-cloudfront': {
    enabled: true,
    config: {
      client: {
        distributionId: env('WEBSITE_CDN'),
      },
      bulk: true, // invalidate multiple urls in one call (default: true) (recommended)
      bulkTimeout: 500, // milliseconds (default: 500)
      defaultConfig: {
        defaultLocale: 'fr', // default locale (default: empty)
        prefixDefaultLocale: true, // prefix for the default locale (default: false)
        prefixLocalization: true, // prefix url with /{locale}. Eg: /fr for french locale (default: false)
        noTrailingSlash: true, // remove trailing slash at the end of url (default: false)
      },
      contentTypes: {
        'my-content-type-name': {
          prefixLocalization: false, // override defaultConfig.prefixLocalization
          path: ['/*'], // invalidate all pages
        },
        'homepage': {
          localizedPath: {
            fr: ['/accueil'],
            en: ['/home'],
          },
        },
        'article': {
          localizedPath: {
            fr: ['/article/:slug'], // use the `slug` attribute value of `article` content type
            en: ['/article/:slug'],
          },
        },
      },
    },
  },
  // ...
})
```

The cache will be invalidate when :
- For non-published content :
  - `beforeUpdate`
  - `beforeUpdateMany`
  - `beforeDelete`
  - `beforeDeleteMany`
  - `afterUpdate`
  - `afterUpdateMany`
- For published content :
  - If old content was published :
    - `beforeUpdate`
    - `beforeUpdateMany`
    - `beforeDelete`
    - `beforeDeleteMany`
  - If new content is published :
    - `afterUpdate`
    - `afterUpdateMany`

See more about [lifecycle events](https://docs.strapi.io/dev-docs/backend-customization/models#available-lifecycle-events).

In this example:
- Edit `my-content-type-name` invalidate `/*`
- Edit `homepage` in `fr` invalidate `/fr/accueil`
- Edit `homepage` in `en` invalidate `/en/home`
- Edit the slug `article` in `en` invalidate `/en/article/old-slug` and `/en/article/new-slug`

### ▶️ Invalidate cache with service

You can invalidate some path with the service.

Example in `src/api/my-api-name/content-types/my-content-type-name/lifecycles.js`:

```js
module.exports = {
  afterUpdate(event) {
    strapi.plugin('aws-cloudfront').service('cloudfront').invalidateByEntry('my-content-type-name', event.result) // need to defined the content type in plugin configurations (see above)
    strapi.plugin('aws-cloudfront').service('cloudfront').invalidate(`/some-url`)
  },
}
```
