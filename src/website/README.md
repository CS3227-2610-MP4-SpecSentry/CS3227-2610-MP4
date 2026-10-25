# GitHub Pages product website

`index.html` is a dependency-free static product site, separate from the authenticated
application. Preview with any local static server. The
[Pages workflow](../../.github/workflows/pages.yml) publishes only this directory.

In repository Settings → Pages select **GitHub Actions**. After merging into
`master`, inspect the Pages workflow and its deployment URL. Manual dispatch is
restricted by the workflow to `master`. GitHub environment protection still applies.
Publication and public access have not been verified by this initialization.

Update status, screenshots and the app link only from verified release evidence.
Documentation links target `master` and may not show feature-branch additions
until merged. This site does not replace the separately deployed Render application.
