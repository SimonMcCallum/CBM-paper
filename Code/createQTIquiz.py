"""Create a QTI quiz package from a Canvas quiz MHTML page.

This script parses the HTML portion of an exported MHTML quiz page and
produces a QTI zip that can be imported into Canvas. The generated quiz
contains a straight copy of the questions without confidence items. A
second script can then inject the confidence questions.
"""

from __future__ import annotations

import argparse
import uuid
import zipfile
from pathlib import Path
from datetime import date
import xml.etree.ElementTree as ET

from bs4 import BeautifulSoup


NS_QTI = "http://www.imsglobal.org/xsd/ims_qtiasiv1p2"
NS_MANIFEST = "http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1"
NS_LOM = "http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource"
NS_IMSMD = "http://www.imsglobal.org/xsd/imsmd_v1p2"


def qti(tag: str) -> str:
    return f"{{{NS_QTI}}}{tag}"


def generate_uuid() -> str:
    return "g" + uuid.uuid4().hex


def extract_html(mhtml_path: Path) -> str:
    """Return the decoded HTML part from an MHTML file."""
    import email

    with open(mhtml_path, "rb") as f:
        msg = email.message_from_binary_file(f)

    for part in msg.walk():
        if part.get_content_type() == "text/html":
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            return payload.decode("utf-8", errors="ignore")
    raise ValueError("No HTML part found in MHTML file")


def parse_questions(html: str) -> list[dict]:
    """Parse HTML and return a list of question dictionaries."""
    soup = BeautifulSoup(html, "lxml")
    questions = []
    for qdiv in soup.find_all("div", class_="display_question"):
        qtype_span = qdiv.find("span", class_="question_type")
        if not qtype_span:
            continue
        qtype = qtype_span.get_text(strip=True)
        text_div = qdiv.find("div", class_="question_text")
        if text_div:
            qtext = text_div.decode_contents()
        else:
            qtext = ""
        point_span = qdiv.find("span", class_="points")
        points = float(point_span.get_text()) if point_span else 1.0
        answers = []
        for ans_div in qdiv.find_all("div", class_="answer_label"):
            answers.append(ans_div.get_text(strip=True))
        questions.append({
            "type": qtype,
            "text": qtext,
            "points": points,
            "answers": answers,
        })
    return questions


def build_qti_xml(questions: list[dict], title: str) -> tuple[ET.ElementTree, str]:
    assessment_id = generate_uuid()
    root = ET.Element(qti("questestinterop"))
    assessment = ET.SubElement(root, qti("assessment"), ident=assessment_id, title=title)
    md = ET.SubElement(assessment, qti("qtimetadata"))
    field = ET.SubElement(md, qti("qtimetadatafield"))
    ET.SubElement(field, qti("fieldlabel")).text = "cc_maxattempts"
    ET.SubElement(field, qti("fieldentry")).text = "1"
    section = ET.SubElement(assessment, qti("section"), ident="root_section")

    for q in questions:
        item_id = generate_uuid()
        item = ET.SubElement(section, qti("item"), ident=item_id, title="Question")
        itemmd = ET.SubElement(item, qti("itemmetadata"))
        qtimd = ET.SubElement(itemmd, qti("qtimetadata"))

        def md_field(label: str, entry: str) -> None:
            f = ET.SubElement(qtimd, qti("qtimetadatafield"))
            ET.SubElement(f, qti("fieldlabel")).text = label
            ET.SubElement(f, qti("fieldentry")).text = entry

        md_field("question_type", q["type"])
        md_field("points_possible", str(q["points"]))
        answer_ids = [str(uuid.uuid4().int % 1000000) for _ in q["answers"]]
        md_field("original_answer_ids", ",".join(answer_ids))

        pres = ET.SubElement(item, qti("presentation"))
        mat = ET.SubElement(pres, qti("material"))
        ET.SubElement(mat, qti("mattext"), texttype="text/html").text = q["text"]

        if q["type"] in {"multiple_choice_question", "multiple_answers_question", "true_false_question"}:
            rcard = "Single" if q["type"] != "multiple_answers_question" else "Multiple"
            resp = ET.SubElement(pres, qti("response_lid"), ident="response1", rcardinality=rcard)
            render = ET.SubElement(resp, qti("render_choice"))
            for ident, text in zip(answer_ids, q["answers"]):
                rl = ET.SubElement(render, qti("response_label"), ident=ident)
                mat = ET.SubElement(rl, qti("material"))
                ET.SubElement(mat, qti("mattext"), texttype="text/plain").text = text
        else:
            # short answer fallback
            resp = ET.SubElement(pres, qti("response_str"), ident="response1", rcardinality="Single")
            ET.SubElement(resp, qti("render_fib"))

        # minimal resprocessing with no scoring
        rp = ET.SubElement(item, qti("resprocessing"))
        out = ET.SubElement(rp, qti("outcomes"))
        ET.SubElement(out, qti("decvar"), varname="SCORE", vartype="Decimal", minvalue="0", maxvalue="0")

    tree = ET.ElementTree(root)
    return tree, assessment_id


def build_assessment_meta(assessment_id: str, title: str, points: float) -> ET.ElementTree:
    root = ET.Element("quiz", identifier=assessment_id, xmlns="http://canvas.instructure.com/xsd/cccv1p0")
    ET.SubElement(root, "title").text = title
    ET.SubElement(root, "description")
    ET.SubElement(root, "shuffle_answers").text = "false"
    ET.SubElement(root, "scoring_policy").text = "keep_highest"
    ET.SubElement(root, "hide_results")
    ET.SubElement(root, "quiz_type").text = "assignment"
    ET.SubElement(root, "points_possible").text = str(points)
    ET.SubElement(root, "require_lockdown_browser").text = "false"
    ET.SubElement(root, "show_correct_answers").text = "true"
    ET.SubElement(root, "anonymous_submissions").text = "false"
    ET.SubElement(root, "time_limit").text = "0"
    ET.SubElement(root, "allowed_attempts").text = "1"
    assign = ET.SubElement(root, "assignment", identifier=generate_uuid())
    ET.SubElement(assign, "title").text = title
    ET.SubElement(assign, "workflow_state").text = "unpublished"
    ET.SubElement(assign, "assignment_overrides")
    ET.SubElement(assign, "quiz_identifierref").text = assessment_id
    ET.SubElement(assign, "points_possible").text = str(points)
    tree = ET.ElementTree(root)
    return tree


def build_manifest(assessment_id: str) -> ET.ElementTree:
    manifest_id = generate_uuid()
    root = ET.Element(
        "manifest",
        identifier=manifest_id,
        xmlns=NS_MANIFEST,
        **{
            f"xmlns:{'lom'}": NS_LOM,
            f"xmlns:{'imsmd'}": NS_IMSMD,
        },
    )
    md = ET.SubElement(root, "metadata")
    ET.SubElement(md, "schema").text = "IMS Content"
    ET.SubElement(md, "schemaversion").text = "1.1.3"
    lom = ET.SubElement(md, f"{{{NS_IMSMD}}}lom")
    gen = ET.SubElement(lom, f"{{{NS_IMSMD}}}general")
    title = ET.SubElement(gen, f"{{{NS_IMSMD}}}title")
    ET.SubElement(title, f"{{{NS_IMSMD}}}string").text = "QTI Quiz Export"
    lc = ET.SubElement(lom, f"{{{NS_IMSMD}}}lifeCycle")
    contrib = ET.SubElement(lc, f"{{{NS_IMSMD}}}contribute")
    date_el = ET.SubElement(contrib, f"{{{NS_IMSMD}}}date")
    ET.SubElement(date_el, f"{{{NS_IMSMD}}}dateTime").text = str(date.today())
    res = ET.SubElement(root, "resources")
    res_assess = ET.SubElement(res, "resource", identifier=assessment_id, type="imsqti_xmlv1p2")
    ET.SubElement(res_assess, "file", href=f"{assessment_id}/{assessment_id}.xml")
    dep_id = generate_uuid()
    ET.SubElement(res_assess, "dependency", identifierref=dep_id)
    res_meta = ET.SubElement(
        res,
        "resource",
        identifier=dep_id,
        type="associatedcontent/imscc_xmlv1p1/learning-application-resource",
        href=f"{assessment_id}/assessment_meta.xml",
    )
    ET.SubElement(res_meta, "file", href=f"{assessment_id}/assessment_meta.xml")
    tree = ET.ElementTree(root)
    return tree


def write_package(output: Path, assessment_id: str, qti_tree: ET.ElementTree, meta_tree: ET.ElementTree, manifest_tree: ET.ElementTree) -> None:
    with zipfile.ZipFile(output, "w") as zf:
        folder = Path(assessment_id)
        zf.writestr("imsmanifest.xml", ET.tostring(manifest_tree.getroot(), encoding="utf-8", xml_declaration=True))
        zf.writestr(str(folder / f"{assessment_id}.xml"), ET.tostring(qti_tree.getroot(), encoding="utf-8", xml_declaration=True))
        zf.writestr(str(folder / "assessment_meta.xml"), ET.tostring(meta_tree.getroot(), encoding="utf-8", xml_declaration=True))
        zf.writestr("non_cc_assessments/", b"")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mhtml", type=Path, help="MHTML file exported from Canvas")
    parser.add_argument("output", type=Path, help="Output zip path")
    parser.add_argument("--title", default="Imported Quiz")
    args = parser.parse_args()

    html = extract_html(args.mhtml)
    questions = parse_questions(html)
    qti_tree, assess_id = build_qti_xml(questions, args.title)
    total_points = sum(q["points"] for q in questions)
    meta_tree = build_assessment_meta(assess_id, args.title, total_points)
    manifest_tree = build_manifest(assess_id)
    write_package(args.output, assess_id, qti_tree, meta_tree, manifest_tree)
    print(f"Wrote quiz with {len(questions)} questions to {args.output}")


if __name__ == "__main__":
    main()
