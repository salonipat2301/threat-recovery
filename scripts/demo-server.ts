import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 4173;

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Threat Recovery Safe Demo</title>
    <style>
      body { font: 16px system-ui, sans-serif; max-width: 620px; margin: 12vh auto; padding: 24px; color: #18181b; }
      main { border: 1px solid #d4d4d8; border-radius: 14px; padding: 28px; }
      label { display: block; margin: 16px 0 6px; font-weight: 600; }
      input { box-sizing: border-box; width: 100%; padding: 10px; border: 1px solid #a1a1aa; border-radius: 7px; }
      button { margin-top: 18px; padding: 10px 14px; }
      .notice { color: #52525b; line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <p class="notice"><strong>Safe local demo.</strong> This page runs only on your computer. Do not enter real credentials. The form never submits or stores anything.</p>
      <h1>Threat Recovery warning demo</h1>
      <form>
        <label for="username">Demo username</label>
        <input id="username" name="username" autocomplete="username" value="demo-user">
        <label for="password">Demo password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" value="demo-only">
        <button type="submit">Simulate sign in</button>
      </form>
    </main>
    <script>document.querySelector("form")?.addEventListener("submit", event => event.preventDefault());</script>
  </body>
</html>`;

createServer((request, response) => {
  if (request.url !== "/" && request.url !== "/demo") {
    response.writeHead(404).end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(page);
}).listen(port, host, () => {
  console.log(`Safe local demo page: http://${host}:${port}`);
  console.log("The form is inert and does not submit or save its contents.");
});
