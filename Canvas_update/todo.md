# Canvas confidence question inserter
Key `[ ]` means open task, `[~]` means in progress, `[?]` means needs review, `[x]` means done.

## Plan
1. Analyse QTI format used by Canvas. Use `preQuiz.zip` as the source quiz and `postCBM.zip` as reference output.
2. Build a Python script that inserts CBM questions after each normal question.
   - Support two templates:
     - Five choice confidence question (not confident → very confident).
     - True/False confidence question.
   - Preserve UUIDs and update `imsmanifest.xml` accordingly.
3. Workflow of the script:
   1. Unzip the quiz archive to a temporary directory.
   2. Parse the assessment XML and collect existing question identifiers.
   3. Generate new item blocks for confidence questions using fresh UUIDs.
   4. Insert these items into the XML and update metadata/manifest.
   5. Repack the directory into a new zip.
4. Create helper module for reading questions so the same data can be reused.
5. Store extracted question metadata in a JSON file for debugging.

## Tasks
- [x] Examine QTI elements that change between `preQuiz.zip` and `postCBM.zip`.
- [x] Implement functions to parse a quiz zip and return question details. *(Started with `extract_question_types.py`)*
- [x] Define confidence question templates in code.
- [x] Implement zip patcher that adds confidence questions and writes a new archive.
- [x] Test with provided sample zips.
