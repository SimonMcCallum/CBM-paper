"""Insert confidence based marking questions into a Canvas quiz zip."""
from __future__ import annotations

import argparse
from pathlib import Path
import uuid
import zipfile
import xml.etree.ElementTree as ET
from typing import List

# reuse helper to read existing questions
from extract_question_types import extract_questions


def generate_uuid() -> str:
    """Return a Canvas style UUID starting with 'g'."""
    return 'g' + uuid.uuid4().hex


def parse_quiz_zip(zip_path: Path) -> tuple[ET.ElementTree, str]:
    """Return XML tree of the quiz and path within the zip."""
    with zipfile.ZipFile(zip_path) as zf:
        xml_name = next(
            name for name in zf.namelist()
            if name.endswith('.xml')
            and '/' in name
            and not name.endswith('assessment_meta.xml')
            and name != 'imsmanifest.xml'
        )
        tree = ET.ElementTree(ET.fromstring(zf.read(xml_name)))
    return tree, xml_name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='Path to Canvas quiz zip')
    parser.add_argument('output', type=Path, help='Output zip with CBM questions')
    args = parser.parse_args()

    # placeholder: extract question info and print
    questions = extract_questions(args.input)
    for q in questions:
        print(f"Found {q['question_type']} {q['ident']}")

    # TODO: insert CBM questions and write new zip


if __name__ == '__main__':
    main()

