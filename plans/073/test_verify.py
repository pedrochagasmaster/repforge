"""Fault injection for risks that browser journeys cannot prove: publication privacy,
provenance and corruption of this offline evidence artifact. Written before checker.
"""
import copy
import json
import unittest
import subprocess
import sys
import tempfile
from unittest.mock import patch
from pathlib import Path
from verify import validate

class VerificationFaults(unittest.TestCase):
    def test_committed_artifact_through_cli(self):
        result=subprocess.run(
            [sys.executable, '-B', str(Path(__file__).parent/'verify.py')],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {
            'observedCycles': 1, 'declaredCycles': 7,
            'trainingDays': 3, 'exercises': 18, 'sets': 45,
        })

    def test_faults(self):
        good = json.loads((Path(__file__).parent/'data/supplement.json').read_text())
        validate(good)
        def personal(d): d['observation']['days'][0]['exercises'][0]['personal']={'email':'private@example.invalid'}
        def provenance(d): del d['sources'][0]['sha256']
        def rule(d): d['contracts']['automatic'][1]['split']='fullBody'
        def dose(d): d['observation']['days'][0]['exercises'][0]['sets'][0]['rir']=0
        def name(d): d['observation']['days'][0]['exercises'][0]['name']='Other movement'
        def structure(d): d['observation']['days'].reverse()
        for mutation in [personal, provenance, rule, dose, name, structure]:
            with self.subTest(mutation=mutation.__name__):
                bad=copy.deepcopy(good); mutation(bad)
                with self.assertRaises(ValueError): validate(bad)
                with tempfile.TemporaryDirectory() as tmp:
                    artifact=Path(tmp)/"bad.json"
                    artifact.write_text(json.dumps(bad))
                    result=subprocess.run([sys.executable,str(Path(__file__).parent/"verify.py"),str(artifact)],capture_output=True)
                    self.assertNotEqual(result.returncode,0,"CLI accepted "+mutation.__name__)

    def test_duplicate_json_keys(self):
        raw=(Path(__file__).parent/'data/supplement.json').read_text()
        cases={
            'root': raw.replace('"version": 1','"version": 99, "version": 1',1),
            'nested': raw.replace('"name": "Pause Barbell Bench Press"','"name": "private@example.invalid", "name": "Pause Barbell Bench Press"',1),
        }
        for name,content in cases.items():
            with self.subTest(duplicate=name), tempfile.TemporaryDirectory() as tmp:
                artifact=Path(tmp)/'duplicate.json'; artifact.write_text(content)
                result=subprocess.run([sys.executable,str(Path(__file__).parent/'verify.py'),str(artifact)],capture_output=True)
                self.assertNotEqual(result.returncode,0,'CLI accepted duplicate '+name)
                self.assertIn(b'duplicate JSON key',result.stderr)
                from extract import extract
                with patch.object(Path,'read_bytes',return_value=content.encode()):
                    with self.assertRaisesRegex(ValueError,'duplicate JSON key'):
                        extract(Path('unused-private-source'))

if __name__=='__main__': unittest.main()
