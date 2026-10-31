"use strict";
const fs = require("fs");
const path = require("path");
const sql = fs.readFileSync(path.join(__dirname, "../scripts/sql/gate-d-security-inventory.sql"), "utf8");
describe("Gate D security inventory is read-only and bounded", () => {
  test("explicit read-only transaction, statement timeout, rollback", () => {
    expect(sql).toMatch(/BEGIN READ ONLY;/i);
    expect(sql).toMatch(/SET LOCAL statement_timeout = '20s';/i);
    expect(sql.trim()).toMatch(/ROLLBACK;$/i);
  });
  test("only permitted metadata queries, no mutation or raw table rows", () => {
    const withoutComments = sql.replace(/^--.*$/gm, "");
    expect(withoutComments).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|GRANT|REVOKE|DROP|CREATE|COPY|DO|EXECUTE)\b/i);
    expect(withoutComments).toMatch(/pg_default_acl/);
    expect(withoutComments).toMatch(/aclexplode/);
    expect(withoutComments).toMatch(/pg_proc/);
    expect(withoutComments).toMatch(/pg_class/);
    expect(withoutComments).toMatch(/prosecdef/);
    expect(withoutComments).toMatch(/relrowsecurity/);
  });
  test("target and role evidence is explicit", () => {
    expect(sql).toMatch(/transaction_read_only/);
    expect(sql).toMatch(/current_database\(\)/);
    expect(sql).toMatch(/current_user/);
    expect(sql).toMatch(/'anon'/);
    expect(sql).toMatch(/'authenticated'/);
  });
});
