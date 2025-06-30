"""Insert confidence based marking questions into a Canvas quiz zip."""

from __future__ import annotations

import argparse
from pathlib import Path
import uuid
import zipfile
import xml.etree.ElementTree as ET


NS = {"qti": "http://www.imsglobal.org/xsd/ims_qtiasiv1p2"}


def qti(tag: str) -> str:
    """Return fully-qualified QTI tag."""
    return f"{{{NS['qti']}}}{tag}"


def make_material(text: str, texttype: str = "text/html") -> ET.Element:
    mat = ET.Element(qti("material"))
    mattext = ET.SubElement(mat, qti("mattext"), texttype=texttype)
    mattext.text = text
    return mat


def confidence_item(for_tf: bool = False) -> ET.Element:
    """Return an item element asking about confidence."""
    ident = generate_uuid()
    title = "Confidence T/F" if for_tf else "Confidence (for 5 choice)"
    item = ET.Element(qti("item"), ident=ident, title=title)

    # metadata
    itemmd = ET.SubElement(item, qti("itemmetadata"))
    qtimd = ET.SubElement(itemmd, qti("qtimetadata"))
    field = ET.SubElement(qtimd, qti("qtimetadatafield"))
    ET.SubElement(field, qti("fieldlabel")).text = "question_type"
    ET.SubElement(field, qti("fieldentry")).text = "multiple_choice_question"
    field = ET.SubElement(qtimd, qti("qtimetadatafield"))
    ET.SubElement(field, qti("fieldlabel")).text = "points_possible"
    ET.SubElement(field, qti("fieldentry")).text = "0.0"

    # presentation
    pres = ET.SubElement(item, qti("presentation"))
    mat = make_material(
        "<div><p>How confident are you in the {} question you were just asked.</p></div>".format(
            "True/False" if for_tf else "previous"
        )
    )
    pres.append(mat)
    resp = ET.SubElement(
        pres, qti("response_lid"), ident="response1", rcardinality="Single"
    )
    render = ET.SubElement(resp, qti("render_choice"))

    labels = (
        ["Not confident", "Somewhat", "Very"]
        if not for_tf
        else ["no confidence", "somewhat confident", "Very confident"]
    )
    ids = [str(i + 1) for i in range(len(labels))]
    ET.SubElement(qtimd, qti("qtimetadatafield"))
    fieldlist = qtimd.findall(qti("qtimetadatafield"))[-1]
    ET.SubElement(fieldlist, qti("fieldlabel")).text = "original_answer_ids"
    ET.SubElement(fieldlist, qti("fieldentry")).text = ",".join(ids)

    for ident_option, text in zip(ids, labels):
        rl = ET.SubElement(render, qti("response_label"), ident=ident_option)
        rl.append(make_material(text, texttype="text/plain"))

    return item


def generate_uuid() -> str:
    """Return a Canvas style UUID starting with 'g'."""
    return "g" + uuid.uuid4().hex


def parse_quiz_zip(zip_path: Path) -> tuple[ET.ElementTree, str]:
    """Return XML tree of the quiz and path within the zip."""
    with zipfile.ZipFile(zip_path) as zf:
        xml_name = next(
            name
            for name in zf.namelist()
            if name.endswith(".xml")
            and "/" in name
            and not name.endswith("assessment_meta.xml")
            and name != "imsmanifest.xml"
        )
        tree = ET.ElementTree(ET.fromstring(zf.read(xml_name)))
    return tree, xml_name


def insert_confidence_items(tree: ET.ElementTree) -> None:
    """Modify XML tree by inserting confidence items after each question."""
    root = tree.getroot()
    section = root.find(qti("assessment")).find(qti("section"))
    items = section.findall(qti("item"))
    for idx, item in enumerate(list(items)):
        qtype = None
        for field in item.findall(".//" + qti("qtimetadatafield")):
            label = field.find(qti("fieldlabel"))
            entry = field.find(qti("fieldentry"))
            if (
                label is not None
                and entry is not None
                and label.text == "question_type"
            ):
                qtype = entry.text
                break
        conf = confidence_item(for_tf=(qtype == "true_false_question"))
        section.insert(idx * 2 + 1, conf)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Path to Canvas quiz zip")
    parser.add_argument("output", type=Path, help="Output zip with CBM questions")
    args = parser.parse_args()

    tree, xml_name = parse_quiz_zip(args.input)
    insert_confidence_items(tree)

    # Extract original zip to temp directory
    from tempfile import TemporaryDirectory

    with TemporaryDirectory() as tmp:
        with zipfile.ZipFile(args.input) as zf:
            zf.extractall(tmp)
        tree.write(Path(tmp) / xml_name, encoding="utf-8", xml_declaration=True)

        with zipfile.ZipFile(args.output, "w") as out:
            for path in Path(tmp).rglob("*"):
                if path.is_file():
                    out.write(path, path.relative_to(tmp))

    print(f"Wrote updated quiz to {args.output}")


if __name__ == "__main__":
    main()
