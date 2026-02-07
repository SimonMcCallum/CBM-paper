<template>
  <div class="methodology">
    <h1>Methodology</h1>

    <div class="card">
      <h2>Confidence-Based Marking (CBM)</h2>
      <p>
        Confidence-Based Marking is an assessment method where the test-taker must indicate
        their confidence in each answer. The score is adjusted based on both correctness and
        confidence, rewarding well-calibrated certainty and penalizing overconfidence on wrong answers.
      </p>
    </div>

    <div class="card">
      <h2>Scoring Systems</h2>

      <h3>Discrete CBM (3-Level)</h3>
      <table class="scoring-table">
        <thead>
          <tr>
            <th>Level</th>
            <th>Confidence Range</th>
            <th>Correct</th>
            <th>Incorrect</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1 (Low)</td>
            <td>&lt; 50%</td>
            <td class="good">+1.0</td>
            <td>0.0</td>
          </tr>
          <tr>
            <td>2 (Medium)</td>
            <td>50% &ndash; 75%</td>
            <td class="good">+1.5</td>
            <td class="bad">-0.5</td>
          </tr>
          <tr>
            <td>3 (High)</td>
            <td>&gt; 75%</td>
            <td class="good">+2.0</td>
            <td class="bad">-2.0</td>
          </tr>
        </tbody>
      </table>

      <h3 style="margin-top: 1.5rem;">Continuous HLCC</h3>
      <p>The model reports confidence <em>x</em> in [0, 1]. Scoring:</p>
      <ul>
        <li><strong>Correct answer:</strong> score = x + 1 (range: 1.0 to 2.0)</li>
        <li><strong>Incorrect answer:</strong> score = &minus;2x&sup2; (range: 0.0 to &minus;2.0)</li>
      </ul>
      <p>This function is <em>incentive-compatible</em>: the expected score is maximized when
        reported confidence equals the true probability of being correct.</p>
    </div>

    <div class="card">
      <h2>Prompting Strategies</h2>

      <h3>Combined (Single-Turn)</h3>
      <p>
        The model receives the question and is asked to provide both the answer and confidence
        level in a single JSON response. This tests the model's ability to self-assess
        simultaneously with answering.
      </p>

      <h3 style="margin-top: 1rem;">Linear (Two-Turn)</h3>
      <p>
        Turn 1: The model answers the question (letter only).<br>
        Turn 2: The model is asked for its confidence level, with the conversation context maintained.
        This tests whether separating the answer from confidence assessment affects calibration.
      </p>
    </div>

    <div class="card">
      <h2>The 4 Variants</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Combined (1-turn)</th>
            <th>Linear (2-turn)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Discrete CBM</th>
            <td>Answer + confidence {1,2,3}</td>
            <td>Turn 1: answer. Turn 2: confidence {1,2,3}</td>
          </tr>
          <tr>
            <th>Continuous HLCC</th>
            <td>Answer + confidence [0.0&ndash;1.0]</td>
            <td>Turn 1: answer. Turn 2: confidence [0.0&ndash;1.0]</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Calibration Metrics</h2>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Ideal Value</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ECE (Expected Calibration Error)</td>
            <td>0.0</td>
            <td>Weighted average of |accuracy - confidence| across bins. Lower = better calibrated.</td>
          </tr>
          <tr>
            <td>Brier Score</td>
            <td>0.0</td>
            <td>Mean squared error of confidence as probability estimate.</td>
          </tr>
          <tr>
            <td>Overconfidence Rate</td>
            <td>0.0</td>
            <td>Fraction of bins where mean confidence exceeds accuracy.</td>
          </tr>
          <tr>
            <td>Calibration Gap (Ambiguous)</td>
            <td>0.0</td>
            <td>How much reported confidence exceeds ideal confidence on ambiguous questions.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Datasets</h2>
      <table>
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Questions</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>MMLU</td>
            <td>~14,000</td>
            <td>Massive Multitask Language Understanding. 57 subjects from STEM, humanities, social sciences.</td>
          </tr>
          <tr>
            <td>TruthfulQA</td>
            <td>~817</td>
            <td>Questions designed to target common misconceptions. Tests truthfulness.</td>
          </tr>
          <tr>
            <td>ARC</td>
            <td>~3,500</td>
            <td>AI2 Reasoning Challenge. Grade-school science questions (Easy + Challenge).</td>
          </tr>
          <tr>
            <td>Ambiguous</td>
            <td>25</td>
            <td>Hand-crafted questions with no single correct answer. Tests calibration under uncertainty.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.methodology h3 {
  color: #1a1a2e;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
}

ul {
  margin: 0.5rem 0 0 1.5rem;
}

li {
  margin-bottom: 0.25rem;
}

.scoring-table {
  max-width: 500px;
}

.good { color: #16a34a; font-weight: 600; }
.bad { color: #dc2626; font-weight: 600; }

em { font-style: italic; }
</style>
