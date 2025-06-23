import argparse
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_qti_zip(zip_path: Path):
    """Parse a Canvas QTI export zip and return list of (ident, question_type, title)."""
    with zipfile.ZipFile(zip_path, 'r') as zf:
        # find xml file that matches assessment id
        manifest_name = 'imsmanifest.xml'
        with zf.open(manifest_name) as f:
            manifest = ET.parse(f)
            root = manifest.getroot()
            # determine namespace dynamically
            manifest_ns = root.tag[root.tag.find('{')+1:root.tag.find('}')]
            ns = {'ims': manifest_ns}
            resources = root.findall('.//ims:resource', ns)
            qti_filename = None
            for res in resources:
                if res.get('type') == 'imsqti_xmlv1p2':
                    file_elem = res.find('ims:file', ns)
                    if file_elem is not None:
                        qti_filename = file_elem.get('href')
                        break
            if not qti_filename:
                raise ValueError('Could not find assessment xml in manifest')
        with zf.open(qti_filename) as qti_file:
            tree = ET.parse(qti_file)
    ns_qti = {'qti': 'http://www.imsglobal.org/xsd/ims_qtiasiv1p2'}
    questions = []
    for item in tree.findall('.//qti:item', ns_qti):
        ident = item.get('ident')
        title = item.get('title')
        q_type = None
        for field in item.findall('.//qti:qtimetadatafield', ns_qti):
            label = field.find('qti:fieldlabel', ns_qti)
            if label is not None and label.text == 'question_type':
                entry = field.find('qti:fieldentry', ns_qti)
                q_type = entry.text if entry is not None else None
                break
        questions.append({'ident': ident, 'title': title, 'question_type': q_type})
    return questions


def main():
    parser = argparse.ArgumentParser(description='Extract question types from Canvas QTI zip.')
    parser.add_argument('zipfile', type=Path, help='Path to Canvas quiz zip file')
    parser.add_argument('-o', '--output', type=Path, help='Output JSON file', default='question_types.json')
    args = parser.parse_args()

    data = parse_qti_zip(args.zipfile)
    with open(args.output, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Wrote {len(data)} questions to {args.output}")


if __name__ == '__main__':
    main()
