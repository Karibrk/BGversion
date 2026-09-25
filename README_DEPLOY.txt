BERNOV & DRAGONS V1.3.7.3.gpt — one-time deployment bridge

Required Vercel environment variables:
  GITHUB_TOKEN       fine-grained token, Contents: Read and write, only Bernov-Dragons-GPT
  GITHUB_REPO        Karibrk/Bernov-Dragons-GPT
  GITHUB_BRANCH      main
  BANDD_SYNC_KEY     your own long random secret (32+ chars)

Required Vercel integration:
  Blob store connected to this project. BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN must be available server-side.

AI image generation:
  Uses Vercel AI Gateway. Default model: google/gemini-3.1-flash-image-preview.
  On Vercel, VERCEL_OIDC_TOKEN can authenticate the gateway. BANDD_IMAGE_MODEL can override the model.

After deploy:
  Open Přenos -> Cloud / GitHub / AI -> Připojit cloud.
  Enter BANDD_SYNC_KEY (not the GitHub token).
  Test verifies configuration.
  Changes auto-back up to Vercel Blob.
  Publikovat .gpt writes DENÍK_CORE_V<version>.gpt.html and promotes the same HTML to index.html.
  Each Střípek has ✦ AI obrázek and uses canonical portrait reference files when available.

Canonical face refs included:
  Karibrk, Elie, Tina, Sandor, Mer, Ula, Dědek.
  Volo currently has no canonical reference face in the existing media pack, so he is not identity-locked until one is approved.
