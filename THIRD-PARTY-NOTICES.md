# Third-Party Notices

This inventory records third-party software that is installed, loaded by the application, or shipped in `public/Thirdparty`. It is not a substitute for the license files supplied by each project. Preserve those files and the notices embedded in bundled assets when copying or redistributing them.

## Application License

The OrigoMap Plus application source is licensed under the Mozilla Public License 2.0. See [LICENSE](LICENSE).

## Vendored Software

| Component | Location | License / notice |
| --- | --- | --- |
| Origo Map | `public/Thirdparty/origo-map` | The current upstream Origo package metadata declares BSD-2-Clause: [upstream package.json](https://github.com/origo-map/origo/blob/master/package.json). The vendored copy in this repository has no root `LICENSE` or package manifest, so its exact version and matching copyright notice have not been verified. Confirm the original revision and include its corresponding license notice before redistribution. |
| Jodit | `public/Thirdparty/jodit` | MIT; license text is included in `LICENSE.txt`. |
| Bulma CSS | `public/css/bulma.css` | MIT; the file identifies Bulma 0.9.4 and includes its license header. |

The Origo JavaScript bundle also contains identifiable notices for bundled components, including OpenLayers (BSD-2-Clause), DOMPurify (Apache-2.0 and MPL-2.0), html2canvas (MIT), jsPDF (MIT), Esri code (Apache-2.0), Glide.js (MIT), and ieee754 (BSD-3-Clause). This is a partial inventory based on notices visible in the bundle, not a complete dependency bill of materials. Preserve the comments and obtain the exact upstream Origo release's full notices.

## NPM Runtime Packages

Versions below match `package.json`; license identifiers were taken from the installed package metadata or license file.

| Package | Version | License |
| --- | --- | --- |
| axios | 1.20.0 | MIT |
| bcrypt | 6.0.0 | MIT |
| connect-flash | 0.1.1 | MIT |
| cookie-parser | 1.4.7 | MIT |
| cors | 2.8.6 | MIT |
| dotenv | 18.0.4 | BSD-2-Clause |
| ejs | 6.0.1 | Apache-2.0 |
| express | 5.2.1 | MIT |
| express-fileupload | 1.5.2 | MIT |
| express-http-proxy | 2.1.2 | MIT |
| express-rate-limit | 8.7.0 | MIT |
| express-session | 1.19.0 | MIT |
| fs-extra | 11.4.1 | MIT |
| monaco-editor | 0.52.2 | MIT |
| node-windows | 1.0.0-beta.8 | MIT |
| session-file-store | 1.5.0 | Apache-2.0 |
| video.js | 8.24.1 | Apache-2.0 |
| videojs-vr | 2.0.0 | MIT |
| nodemon (development) | 3.1.14 | MIT |

NPM packages also bring transitive dependencies. Their metadata and license files are installed under `node_modules`; retain `package-lock.json` so the resolved dependency tree can be reproduced and audited.

## Externally Loaded Software

These components are referenced from third-party CDNs rather than vendored here. Their respective upstream terms still apply to use of the remote assets:

| Component | Reference in application | License |
| --- | --- | --- |
| Leaflet | `views/map.ejs` | BSD-2-Clause |
| Proj4 | `views/map.ejs` | MIT |
| Proj4Leaflet | `views/map.ejs` | BSD-2-Clause |
| Bulma | `views/index.ejs`, `views/map-list.ejs` | MIT |
| Font Awesome Free | `views/map-list.ejs`, `views/omdb.ejs`, `views/omqgis.ejs`, `views/omstrategi.ejs` | Icons: CC BY 4.0; fonts: SIL OFL 1.1; code: MIT. Check the exact assets and version when redistributing them locally. |
| JSONEditor | `views/edit-json.ejs` | Apache-2.0 |

## Release Checks

- The vendored Origo copy needs a version or commit identifier and the matching BSD-2-Clause copyright/license notice before a release can be considered fully documented.
- `service.js` has an individual GPL-3.0 notice while the repository license is MPL-2.0. Confirm the intended terms and compatibility before redistributing that Windows service installer.
- Review map data, logos, fonts, imagery, and service configuration separately; their rights do not necessarily follow the software license.
- Do not publish local credentials or user data. `.gitignore` excludes the local secret/configuration paths, but it cannot remove files already committed to a Git history.