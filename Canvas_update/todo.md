# Task for creating the python code
Key [ ] means open task, [~] means work in progress, [?] means needs review, [x] means done

## Tasks
- [ ] Analyse `preQuiz.zip` and `postCBM.zip` to understand QTI structure and where CBM questions are inserted.
- [ ] Design python script to insert CBM questions for 5-option multiple choice and true/false items while preserving UUIDs and manifest entries.
- [ ] Extract standard CBM question templates (MCQ and True/False) into a data file for easy insertion.
- [~] Create helper script `extract_question_types.py` to read a QTI zip and output each question's type and identifier to a JSON file.
- [ ] Integrate the extraction script output into the insertion workflow.
- [ ] Document usage examples in README.
