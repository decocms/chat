// Offline only: no Wrangler CLI, authentication, environment-file reads or network.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2] || '.');
const requireProject = createRequire(path.join(root, 'package.json'));
const Ajv = requireProject('ajv');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/wrangler/config-schema.json'), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
const validate = ajv.compile({ $ref: '#/definitions/PreviewsConfig', definitions: schema.definitions });
const directory = __dirname;
let unresolved = 0;
for (const name of ['main', 'site']) {
  const document = JSON.parse(fs.readFileSync(path.join(directory, `${name}.example.jsonc`), 'utf8'));
  assert.deepEqual(Object.keys(document), ['previews']);
  assert(validate(document.previews), `${name}: pinned Wrangler schema rejected template (${validate.errors?.map((error) => error.keyword).join(', ')})`);
  const source = fs.readFileSync(path.join(root, name === 'main' ? 'wrangler.jsonc' : 'site/wrangler.jsonc'), 'utf8');
  const productionStorage = [...source.matchAll(/"(?:database_id|id|bucket_name|namespace_id)"\s*:\s*"([^"]+)"/g)].map((match) => match[1]);
  const values = [];
  function visit(value) {
    if (typeof value === 'string') values.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  }
  visit(document.previews);
  assert(!values.some((value) => productionStorage.includes(value)), `${name}: production storage or rate-limit identifier reused`);
  unresolved += values.filter((value) => value === '<REPLACE_ME>').length;
  assert(!document.previews.services, `${name}: service target requires separate review`);
  assert(!document.previews.durable_objects?.bindings.some((binding) => binding.script_name), `${name}: external DO namespace forbidden`);
  assert(!document.previews.vars?.DEV_EMAIL, `${name}: public preview cannot use DEV_EMAIL`);
  if (name === 'main') {
    assert.deepEqual(document.previews.durable_objects.bindings, [{ name: 'BOOK', class_name: 'Book' }, { name: 'DOC_ROOMS', class_name: 'DocRoom' }, { name: 'PEOPLE', class_name: 'Person' }]);
    for (const variable of ['METRICS_ROOMS', 'ISSUES_ROOM', 'AGENT_STREAK_OFF']) assert.equal(document.previews.vars[variable], '');
    assert(document.previews.send_email.every((binding) => binding.destination_address), 'EMAIL must restrict delivery');
  } else assert.notEqual(document.previews.vars.DECO_ENV_NAME, 'production');
}
console.log(`Pinned-schema and static safety checks passed; unresolved fields: ${unresolved}.`);
if (unresolved && !process.argv.includes('--allow-template')) {
  console.error('BLOCKED: obtain isolated resource metadata before activating these templates.');
  process.exitCode = 2;
}
