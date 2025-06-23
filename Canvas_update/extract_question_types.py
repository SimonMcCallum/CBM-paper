import zipfile
import xml.etree.ElementTree as ET
import json
from pathlib import Path


def extract_questions(zip_path: Path) -> list[dict]:
    """Extract question metadata from a Canvas QTI quiz zip."""
    with zipfile.ZipFile(zip_path) as zf:
        xml_name = next(
            name for name in zf.namelist()
            if name.endswith('.xml')
            and '/' in name
            and not name.endswith('assessment_meta.xml')
            and name != 'imsmanifest.xml'
        )
        data = zf.read(xml_name)
    ns = {'qti': 'http://www.imsglobal.org/xsd/ims_qtiasiv1p2'}
    root = ET.fromstring(data)
    items = []
    for item in root.findall('.//qti:item', ns):
        ident = item.attrib.get('ident')
        title = item.attrib.get('title')
        question_text = None
        for mt in item.findall('.//qti:presentation/qti:material/qti:mattext', ns):
            question_text = mt.text
            break
        qtype = None
        for field in item.findall('.//qti:qtimetadatafield', ns):
            label = field.find('qti:fieldlabel', ns)
            entry = field.find('qti:fieldentry', ns)
            if label is not None and entry is not None and label.text == 'question_type':
                qtype = entry.text
                break
        items.append({'ident': ident, 'title': title, 'question_type': qtype, 'text': question_text})
    return items


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Extract question metadata from Canvas quiz zip')
    parser.add_argument('zipfile', type=Path)
    parser.add_argument('-o', '--output', type=Path, default=Path('question_data.json'))
    args = parser.parse_args()
    data = extract_questions(args.zipfile)
    args.output.write_text(json.dumps(data, indent=2))
    print(f"Wrote {len(data)} questions to {args.output}")


if __name__ == '__main__':
    main()

