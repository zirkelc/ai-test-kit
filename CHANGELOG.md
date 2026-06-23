# Changelog

## [2.0.0-next.3](https://github.com/zirkelc/ai-test-kit/compare/v2.0.0-next.2...v2.0.0-next.3) (2026-06-23)


### Features

* **language:** add streamParts builder ([fac3506](https://github.com/zirkelc/ai-test-kit/commit/fac35063800de513f6ebfe0a690097e19dd9a62c))


### Code Refactoring

* tidy image API and trim unnecessary exports ([e2068c6](https://github.com/zirkelc/ai-test-kit/commit/e2068c6b2c3825a3e49d1eac72e2cb35e79c0de0))

## [2.0.0-next.2](https://github.com/zirkelc/ai-test-kit/compare/v2.0.0-next.1...v2.0.0-next.2) (2026-06-22)


### Bug Fixes

* **streams:** emit without a timer for non-positive delays ([2ff43a9](https://github.com/zirkelc/ai-test-kit/commit/2ff43a9ef8ca6e5690318653ecad4f51edca3ee6))

## [2.0.0-next.1](https://github.com/zirkelc/ai-test-kit/compare/v2.0.0-next...v2.0.0-next.1) (2026-06-19)


### Continuous Integration

* scope push trigger to main and next ([efd2b45](https://github.com/zirkelc/ai-test-kit/commit/efd2b45e35711df75e6fc4b7643f0956f0b36bfd))

## [2.0.0-next](https://github.com/zirkelc/ai-test-kit/compare/v1.4.0...v2.0.0-next) (2026-06-19)


### ⚠ BREAKING CHANGES

* ContentParts and StreamParts are removed; use the Language namespace (stream parts are stream-prefixed). The result, usage, and finishReason builders move off the mock namespaces onto Language / Embedding / Image. MockImageModel.image becomes Image.png().

### Features

* restructure model namespaces into Language/Embedding/Image ([f05ed88](https://github.com/zirkelc/ai-test-kit/commit/f05ed88da86ea68ff43c5b473a3e16993494527c))


### Continuous Integration

* add next prerelease release line ([18fb645](https://github.com/zirkelc/ai-test-kit/commit/18fb645fca7e8d2deec782475112a3264760d6fc))

## [1.4.0](https://github.com/zirkelc/ai-test-kit/compare/v1.3.0...v1.4.0) (2026-06-18)


### Features

* rename MockResponse keys to doGenerate/doStream ([b94bfb5](https://github.com/zirkelc/ai-test-kit/commit/b94bfb5682a656678986837206523686ca142a8d))


### Code Refactoring

* rename files to match pluralized namespaces ([7bd22c0](https://github.com/zirkelc/ai-test-kit/commit/7bd22c08432ba3aa272c32dd46bfcc6be5e167af))

## [1.3.0](https://github.com/zirkelc/ai-test-kit/compare/v1.2.0...v1.3.0) (2026-06-15)


### Features

* add Errors namespace for mocking provider errors ([04c5a28](https://github.com/zirkelc/ai-test-kit/commit/04c5a28f7f68a5b4278b675fc533a898d489e24f))

## [1.2.0](https://github.com/zirkelc/ai-test-kit/compare/v1.1.0...v1.2.0) (2026-06-15)


### Features

* add embedding and image model mocks ([c23af48](https://github.com/zirkelc/ai-test-kit/commit/c23af4840efdd2d5a9d61977880463398327cd31))


### Code Refactoring

* move Stream/Iterable to root and pluralize builder namespaces ([b090ad5](https://github.com/zirkelc/ai-test-kit/commit/b090ad5ec2ffffa075b2ba7849f4c71f8d066f64))


### Documentation

* add logo and banner assets, logo into README ([3775af6](https://github.com/zirkelc/ai-test-kit/commit/3775af619172f58b42b21fd10eb86b6d8f519b40))
* enlarge checkmarks and add spacing below logo mark ([8d62f9b](https://github.com/zirkelc/ai-test-kit/commit/8d62f9b8874fb7005d415f02d5bf858c647cce19))
* fix tool part key and clarify tool-${string} prefix selection ([4cb79a2](https://github.com/zirkelc/ai-test-kit/commit/4cb79a23ea400309b0a65ea5a5f08a2a24d3c1e3))


### Continuous Integration

* bump actions to Node 24 runtimes ([#4](https://github.com/zirkelc/ai-test-kit/issues/4)) ([d306815](https://github.com/zirkelc/ai-test-kit/commit/d30681515dfb21c07c500ac1dd6a9f4cccf85637))

## [1.1.0](https://github.com/zirkelc/ai-test-kit/compare/v1.0.1...v1.1.0) (2026-06-11)


### Features

* **ui:** add UIMessage type inferers ([1510477](https://github.com/zirkelc/ai-test-kit/commit/1510477e207eea9c15f87ef0d4c3f3012f5677c0))


### Bug Fixes

* **ui:** preserve optional fields in fromUIMessage bound builders ([dfcd094](https://github.com/zirkelc/ai-test-kit/commit/dfcd094c0595ec9567c1e0438038c699758e5e72))

## [1.0.1](https://github.com/zirkelc/ai-test-kit/compare/v1.0.0...v1.0.1) (2026-06-11)


### Bug Fixes

* **ui:** narrow data/tool/dynamicTool builder return types ([564d13b](https://github.com/zirkelc/ai-test-kit/commit/564d13bfeb2d7aa4f2098caa6cb24ba458dfc432))

## [1.0.0](https://github.com/zirkelc/ai-test-kit/compare/v0.0.1...v1.0.0) (2026-06-11)


### Features

* add Iterable namespace and stream/iterable bridges ([79a7a43](https://github.com/zirkelc/ai-test-kit/commit/79a7a4397c6ec7f8838b0bfe2ba176c2cdf9eabe))
* add publishConfig for public access in package.json ([6a0df1d](https://github.com/zirkelc/ai-test-kit/commit/6a0df1dd14d9549976bedab43b6194d4da79aef3))
* add UI message builders and reshape MockLanguageModel namespace ([2d04342](https://github.com/zirkelc/ai-test-kit/commit/2d04342433e45352cc2f83f30a73967ec055910b))
* error simulated streams with AbortError on abort ([1731d43](https://github.com/zirkelc/ai-test-kit/commit/1731d43a37417a474900cb8a7995eb5e023ba149))
* implement mock language model test utilities ([d6cf148](https://github.com/zirkelc/ai-test-kit/commit/d6cf148c196d3145171792e4360da0cf10ce7b30))


### Bug Fixes

* point types to emitted dist/index.d.mts ([fc76617](https://github.com/zirkelc/ai-test-kit/commit/fc766170a78e33a6a1eb209375cbffe05566ef52))


### Code Refactoring

* simplify stream response union and align builders ([3095364](https://github.com/zirkelc/ai-test-kit/commit/309536448bd519b7c439f6c5a47bddbdd666d0b6))


### Documentation

* tighten intro and drop ai/test reference ([b2d10be](https://github.com/zirkelc/ai-test-kit/commit/b2d10be9be4ca121fc824c4cf247a752a10149ec))


### Continuous Integration

* drop redundant format check from lint job ([7f47b74](https://github.com/zirkelc/ai-test-kit/commit/7f47b749db7c71448e682870d212a7721fc14b7b))


### Miscellaneous Chores

* rename package to ai-sdk-test ([48f9666](https://github.com/zirkelc/ai-test-kit/commit/48f9666958bdcb6b5fe04f6b66636314eb99c348))
* reserve ai-test ([e339b75](https://github.com/zirkelc/ai-test-kit/commit/e339b757191addbc72c889aa77d3b764015afcaf))
