(async () => {
  const {default: JSZip} = await import(chrome.runtime.getURL('jszip.min.js'));

  function uuid() {
    return 'g' + crypto.randomUUID().replace(/-/g, '');
  }

  function parseQuestions() {
    const qs = [];
    document.querySelectorAll('div.display_question').forEach(div => {
      const typeSpan = div.querySelector('span.question_type');
      if (!typeSpan) return;
      const qtype = typeSpan.textContent.trim();
      const textDiv = div.querySelector('div.question_text');
      const qtext = textDiv ? textDiv.innerHTML : '';
      const pointsSpan = div.querySelector('span.points');
      const points = pointsSpan ? parseFloat(pointsSpan.textContent) : 1;
      const answers = [];
      div.querySelectorAll('div.answer_label').forEach(a => {
        answers.push(a.textContent.trim());
      });
      qs.push({type: qtype, text: qtext, points, answers});
    });
    return qs;
  }

  function buildQTI(questions, title) {
    const NS_QTI = 'http://www.imsglobal.org/xsd/ims_qtiasiv1p2';
    const doc = document.implementation.createDocument(NS_QTI, 'questestinterop');
    const assessmentId = uuid();
    const assessment = doc.createElementNS(NS_QTI, 'assessment');
    assessment.setAttribute('ident', assessmentId);
    assessment.setAttribute('title', title);
    doc.documentElement.appendChild(assessment);

    const md = doc.createElementNS(NS_QTI, 'qtimetadata');
    const field = doc.createElementNS(NS_QTI, 'qtimetadatafield');
    const label = doc.createElementNS(NS_QTI, 'fieldlabel');
    label.textContent = 'cc_maxattempts';
    const entry = doc.createElementNS(NS_QTI, 'fieldentry');
    entry.textContent = '1';
    field.appendChild(label);
    field.appendChild(entry);
    md.appendChild(field);
    assessment.appendChild(md);

    const section = doc.createElementNS(NS_QTI, 'section');
    section.setAttribute('ident', 'root_section');
    assessment.appendChild(section);

    for (const q of questions) {
      const itemId = uuid();
      const item = doc.createElementNS(NS_QTI, 'item');
      item.setAttribute('ident', itemId);
      item.setAttribute('title', 'Question');
      section.appendChild(item);

      const presentation = doc.createElementNS(NS_QTI, 'presentation');
      const material = doc.createElementNS(NS_QTI, 'material');
      const text = doc.createElementNS(NS_QTI, 'mattext');
      text.setAttribute('texttype', 'text/html');
      text.textContent = q.text;
      material.appendChild(text);
      presentation.appendChild(material);

      if (['multiple_choice_question', 'multiple_answers_question', 'true_false_question'].includes(q.type)) {
        const rcard = q.type === 'multiple_answers_question' ? 'Multiple' : 'Single';
        const response = doc.createElementNS(NS_QTI, 'response_lid');
        response.setAttribute('ident', 'response1');
        response.setAttribute('rcardinality', rcard);
        const render = doc.createElementNS(NS_QTI, 'render_choice');
        const ids = q.answers.map(() => String(Math.floor(Math.random()*1000000)));
        q.answers.forEach((ans, i) => {
          const rl = doc.createElementNS(NS_QTI, 'response_label');
          rl.setAttribute('ident', ids[i]);
          const amat = doc.createElementNS(NS_QTI, 'material');
          const atext = doc.createElementNS(NS_QTI, 'mattext');
          atext.setAttribute('texttype', 'text/plain');
          atext.textContent = ans;
          amat.appendChild(atext);
          rl.appendChild(amat);
          render.appendChild(rl);
        });
        response.appendChild(render);
        presentation.appendChild(response);
      } else {
        const resp = doc.createElementNS(NS_QTI, 'response_str');
        resp.setAttribute('ident', 'response1');
        resp.setAttribute('rcardinality', 'Single');
        resp.appendChild(doc.createElementNS(NS_QTI, 'render_fib'));
        presentation.appendChild(resp);
      }

      item.appendChild(presentation);
    }

    return {xml: new XMLSerializer().serializeToString(doc), assessmentId};
  }

  function buildMeta(assessmentId, title, points) {
    const doc = document.implementation.createDocument('http://canvas.instructure.com/xsd/cccv1p0', 'quiz');
    doc.documentElement.setAttribute('identifier', assessmentId);
    const t = doc.createElement('title');
    t.textContent = title;
    doc.documentElement.appendChild(t);
    const pp = doc.createElement('points_possible');
    pp.textContent = String(points);
    doc.documentElement.appendChild(pp);
    return new XMLSerializer().serializeToString(doc);
  }

  function buildManifest(assessmentId) {
    const NS_MANIFEST = 'http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1';
    const doc = document.implementation.createDocument(NS_MANIFEST, 'manifest');
    doc.documentElement.setAttribute('identifier', uuid());
    const resources = doc.createElement('resources');
    const res = doc.createElement('resource');
    res.setAttribute('identifier', assessmentId);
    res.setAttribute('type', 'imsqti_xmlv1p2');
    const file = doc.createElement('file');
    file.setAttribute('href', `${assessmentId}/${assessmentId}.xml`);
    res.appendChild(file);
    resources.appendChild(res);
    doc.documentElement.appendChild(resources);
    return new XMLSerializer().serializeToString(doc);
  }

  const questions = parseQuestions();
  if (!questions.length) {
    alert('No quiz questions found on this page');
    return;
  }
  const title = document.querySelector('h1')?.textContent || 'Imported Quiz';
  const {xml: qtiXml, assessmentId} = buildQTI(questions, title);
  const points = questions.reduce((sum, q) => sum + q.points, 0);
  const metaXml = buildMeta(assessmentId, title, points);
  const manifestXml = buildManifest(assessmentId);

  const zip = new JSZip();
  zip.file('imsmanifest.xml', manifestXml);
  const folder = zip.folder(assessmentId);
  folder.file(`${assessmentId}.xml`, qtiXml);
  folder.file('assessment_meta.xml', metaXml);

  const blob = await zip.generateAsync({type: 'blob'});
  const url = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({downloadUrl: url, filename: `${title}.zip`});
})();
