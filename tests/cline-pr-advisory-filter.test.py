"""Unit tests for manual advisory diff filtering; no API calls."""
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / ".github/scripts/cline_pr_advisory.py"
spec = importlib.util.spec_from_file_location("cline_pr_advisory", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AdvisoryFilterTests(unittest.TestCase):
    def test_public_source_allowed(self):
        self.assertTrue(module.is_allowed("src/components/engine.js"))
        self.assertTrue(module.is_allowed("tests/unit/engine.test.ts"))

    def test_sensitive_paths_denied(self):
        for path in ("src/auth/login.js", "src/student/grades.ts",
                     "assessment/questions/item.js", "src/telemetry.js",
                     ".github/workflows/ci.yml", "src/data.json"):
            with self.subTest(path=path):
                self.assertFalse(module.is_allowed(path))

    def test_secrets_are_blocked(self):
        examples = (
            "+ api_key = 'abcdef123456789XYZ'",
            "+ Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
            "+ ghp_" + "A" * 32,
            "+ AKIA" + "B" * 16,
            "+ student_id: 123",
            "+ -----BEGIN PRIVATE KEY-----",
        )
        for patch in examples:
            with self.subTest(patch=patch[:12]):
                self.assertTrue(module.patch_is_sensitive(patch))

    def test_nonsensitive_patch(self):
        self.assertFalse(module.patch_is_sensitive("@@ -1 +1 @@\n- return 1\n+ return 2\n"))


if __name__ == "__main__":
    unittest.main()
