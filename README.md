# Array Editor

A free, open-source, bilingual (English / Spanish) browser tool for reordering and editing arrays of objects in **JSON, JSON5, and YAML**. You can upload a local file or paste plain text, edit objects and nested array values, reorder items, and download the result in JSON, JSON5, or YAML.

**Privacy by design:** the document is parsed and edited in your browser. This application has no backend and does not upload your content. The hosting provider may still collect basic access logs under its own policies. YAML comments and source formatting are normalized when an output document is generated.

## Features

- Import `.json`, `.json5`, `.yaml`, `.yml`, and `.txt` files.
- Paste JSON/JSON5/YAML directly into the text area.
- Auto-detect JSON, JSON5, or YAML, or force a particular input format.
- Export as JSON, JSON5, YAML, or the same format as the input.
- Reorder records with drag-and-drop or up/down buttons.
- Search, add, edit, and delete records.
- Dynamically generated form controls for fields, nested objects, numbers, booleans, null values, and arrays.
- Add/remove array elements through individual controls, including nested arrays.
- Switch the interface between English and Spanish; the preference is stored locally in the browser when storage is available.
- Optional voluntary donation links, configured by the maintainer. No features are paywalled.

## Requirements

- Node.js 20.19+ (or a compatible current LTS release) and pnpm.

## Develop locally

```sh
pnpm install
pnpm run dev
```

Open the local URL printed by Vite.

## Verify and build

```sh
pnpm run check
pnpm run build
pnpm run preview
```

The static production site is generated in `dist/` and can be hosted on any static host. For Git-based deployment, connect this repository to a static hosting provider and set the build command to `pnpm run build` and the output directory to `dist`.

## Configure donations

Edit `CONFIG.supportLinks` near the top of `src/main.js` and add only public HTTPS payment links you have personally verified. The available keys are `paypal`, `koFi`, and `other`. Empty values are hidden from visitors. Never place private keys, passwords, or tokens here. Confirm your provider's ability to receive and withdraw payments from your own account and location before publishing a link.

## Project documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Format support and future formats](docs/FORMATS.md)
- [Testing checklist](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).
