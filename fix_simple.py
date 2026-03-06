import re

# ─── pagespeed.js ───
path = r'C:\Users\gabri\Desktop\prospector\server\src\routes\pagespeed.js'
code = open(path, encoding='utf-8').read()

# Fix INSERT db.prepare().run() multi-line → await db.run()
old = """    const info = db.prepare(
      `INSERT INTO pagespeed_reports (url, strategy, scores_json, metrics_json, opportunities_json, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(target, 'both',
      JSON.stringify({ mobile: mobile.scores, desktop: desktop.scores }),
      JSON.stringify({ mobile: mobile.metrics, desktop: desktop.metrics }),
      JSON.stringify({ mobile: mobile.opportunities, desktop: desktop.opportunities }),
      JSON.stringify({ mobile: mobile.diagnostics, desktop: desktop.diagnostics }),
    );
    result.id = info.lastInsertRowid;"""

new = """    const info = await db.run(
      `INSERT INTO pagespeed_reports (url, strategy, scores_json, metrics_json, opportunities_json, diagnostics_json) VALUES (?, ?, ?, ?, ?, ?)`,
      [target, 'both',
        JSON.stringify({ mobile: mobile.scores, desktop: desktop.scores }),
        JSON.stringify({ mobile: mobile.metrics, desktop: desktop.metrics }),
        JSON.stringify({ mobile: mobile.opportunities, desktop: desktop.opportunities }),
        JSON.stringify({ mobile: mobile.diagnostics, desktop: desktop.diagnostics }),
      ]
    );
    result.id = info.lastInsertRowid;"""

code = code.replace(old, new)

# Fix SELECT .all()
code = code.replace(
    "    const reports = db.prepare('SELECT id, url, strategy, scores_json, created_at FROM pagespeed_reports ORDER BY created_at DESC LIMIT 50').all();",
    "    const reports = await db.all('SELECT id, url, strategy, scores_json, created_at FROM pagespeed_reports ORDER BY created_at DESC LIMIT 50');"
)

# Fix DELETE .run(id)
code = code.replace(
    "    db.prepare('DELETE FROM pagespeed_reports WHERE id = ?').run(id);",
    "    await db.run('DELETE FROM pagespeed_reports WHERE id = ?', [id]);"
)

# Fix SELECT .get(req.params.id)
code = code.replace(
    "    const report = db.prepare('SELECT * FROM pagespeed_reports WHERE id = ?').get(req.params.id);",
    "    const report = await db.get('SELECT * FROM pagespeed_reports WHERE id = ?', [Number(req.params.id)]);"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print(f'pagespeed.js: {len(open(path, encoding="utf-8").readlines())} lines, db.prepare remaining: {code.count("db.prepare")}')

# ─── contracts-pdf.js ───
path = r'C:\Users\gabri\Desktop\prospector\server\src\routes\contracts-pdf.js'
code = open(path, encoding='utf-8').read()

# Make getContract async
code = code.replace(
    'function getContract(id, extraFields = \'\') {\n  const fields = extraFields ? `, ${extraFields}` : \'\';\n  return db.prepare(`SELECT ct.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state${fields} FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.id = ?`).get(id);\n}',
    'async function getContract(id, extraFields = \'\') {\n  const fields = extraFields ? `, ${extraFields}` : \'\';\n  return await db.get(`SELECT ct.*, c.company_name, c.contact_name, c.email, c.phone, c.cnpj, c.address, c.city, c.state${fields} FROM contracts ct JOIN clients c ON ct.client_id = c.id WHERE ct.id = ?`, [Number(id)]);\n}'
)

# Make all 7 route handlers async
code = re.sub(
    r"router\.get\('/:id/(pdf|proposal|acceptance|addendum|termination|receipt|briefing)', \(req, res\) => \{",
    r"router.get('/:id/\1', async (req, res) => {",
    code
)

# Make all getContract calls await
code = code.replace(
    '    const contract = getContract(req.params.id);',
    '    const contract = await getContract(req.params.id);'
)
code = code.replace(
    "    const contract = getContract(req.params.id, 'c.website');",
    "    const contract = await getContract(req.params.id, 'c.website');"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(code)
print(f'contracts-pdf.js: {len(open(path, encoding="utf-8").readlines())} lines, db.prepare remaining: {code.count("db.prepare")}, async getContract: {code.count("async function getContract")}')
