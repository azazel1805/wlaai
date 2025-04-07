// static/js/script.js

document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- Global Variables & State ---
    let topicQuestions = []; // Store questions for topic generator
    let levelGenQuestions = []; // Store questions for level generator
    let recognition; // Speech Recognition instance
    let isRecording = false;
    const micButton = document.getElementById('mic-button');
    const chatInput = document.getElementById('chat-input');
    const ttsAudio = document.getElementById('tts-audio');
    const chatHistory = document.getElementById('chat-history');

    // Check if SpeechRecognition is available early
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechRecognitionSupported = !!SpeechRecognition; // Boolean check

    // --- Helper Functions ---
    function showLoading(toolPrefix) {
        const loadingDiv = document.getElementById(`${toolPrefix}-loading`);
        if (loadingDiv) loadingDiv.style.display = 'block';
        clearError(toolPrefix); // Hide previous errors
        // Optionally disable the button
        const buttonId = `${toolPrefix}-button`; // Use consistent naming convention
        const button = document.getElementById(buttonId);
        if (button) button.disabled = true;

        // Specific handling for chat buttons
        if (toolPrefix === 'chat') {
            const sendBtn = document.getElementById('send-chat-button');
            const micBtn = document.getElementById('mic-button');
            if(sendBtn) sendBtn.disabled = true;
            if(micBtn) micBtn.disabled = true; // Disable mic while processing
        }
    }

    function hideLoading(toolPrefix) {
        const loadingDiv = document.getElementById(`${toolPrefix}-loading`);
        if (loadingDiv) loadingDiv.style.display = 'none';
        const buttonId = `${toolPrefix}-button`;
        const button = document.getElementById(buttonId);
        if (button) button.disabled = false;

         // Specific handling for chat buttons
         if (toolPrefix === 'chat') {
            const sendBtn = document.getElementById('send-chat-button');
            const micBtn = document.getElementById('mic-button');
            if(sendBtn) sendBtn.disabled = false;
            if(micBtn && !isRecording) micBtn.disabled = false; // Re-enable mic only if not recording
        }
    }

    function showError(toolPrefix, message) {
        const errorDiv = document.getElementById(`${toolPrefix}-error`);
        if (errorDiv) {
            // Sanitize message slightly - prevent basic HTML injection
            const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
            errorDiv.innerHTML = `Error: ${safeMessage}`; // Use innerHTML to allow potential formatting like line breaks if needed later
            errorDiv.style.display = 'block';
        }
        hideLoading(toolPrefix); // Hide loading indicator on error
    }

     function clearError(toolPrefix) {
         const errorDiv = document.getElementById(`${toolPrefix}-error`);
         if (errorDiv) {
             errorDiv.textContent = '';
             errorDiv.style.display = 'none';
         }
    }

    function clearOutput(toolPrefix) {
        const outputDiv = document.getElementById(`${toolPrefix}-output`);
        if (outputDiv) {
            outputDiv.style.display = 'none';
        } else {
            console.warn(`Output container div not found for prefix: ${toolPrefix}-output`);
            return;
        }
        try {
            if (toolPrefix === 'corrector') {
                const correctedTextEl = document.getElementById('corrected-text');
                const feedbackListEl = document.getElementById('correction-feedback');
                const correctedTextArea = document.getElementById('corrected-text-area');
                const feedbackArea = document.getElementById('correction-feedback-area');
                if (correctedTextEl) correctedTextEl.textContent = '';
                if (feedbackListEl) feedbackListEl.innerHTML = '';
                if (correctedTextArea) correctedTextArea.style.display = 'none';
                if (feedbackArea) feedbackArea.style.display = 'none';
            } else if (toolPrefix === 'topic-generator') {
                const explanationEl = document.getElementById('topic-explanation');
                const questionsFormEl = document.getElementById('topic-questions-form');
                const checkButtonEl = document.getElementById('check-topic-answers-button');
                const feedbackDivEl = document.getElementById('topic-feedback');
                if (explanationEl) explanationEl.innerHTML = '';
                if (questionsFormEl) questionsFormEl.innerHTML = '';
                if (checkButtonEl) checkButtonEl.style.display = 'none';
                if (feedbackDivEl) feedbackDivEl.innerHTML = '';
            } else if (toolPrefix === 'vocab-helper') {
                if (outputDiv) outputDiv.innerHTML = '';
            } else if (toolPrefix === 'paraphraser') {
                const paraphraseListEl = document.getElementById('paraphrase-list');
                 if (paraphraseListEl) paraphraseListEl.innerHTML = '';
                 const h3 = outputDiv.querySelector('h3');
                 if (h3) h3.remove();
            } else if (toolPrefix === 'level-generator') {
                const textDivEl = document.getElementById('level-gen-text');
                const questionsFormEl = document.getElementById('level-gen-questions-form');
                const checkButtonEl = document.getElementById('check-level-gen-answers-button');
                const feedbackDivEl = document.getElementById('level-gen-feedback');
                if (textDivEl) textDivEl.innerHTML = '';
                if (questionsFormEl) questionsFormEl.innerHTML = '';
                if (checkButtonEl) checkButtonEl.style.display = 'none';
                if (feedbackDivEl) feedbackDivEl.innerHTML = '';
            }
        } catch (error) {
            console.error(`Error during specific clear for ${toolPrefix}:`, error);
        }
    }


    function displayOutput(toolPrefix) {
        const outputDiv = document.getElementById(`${toolPrefix}-output`);
        if (outputDiv) {
            outputDiv.style.display = 'block';
        }
    }


    async function fetchData(endpoint, data, toolPrefix) {
        showLoading(toolPrefix);
        clearError(toolPrefix); // Clear previous errors

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json', // Be explicit about expecting JSON
                },
                body: JSON.stringify(data),
            });

            let responseData = null;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                try {
                    responseData = await response.json();
                } catch (e) {
                    console.error(`Fetch Error (${toolPrefix}): Failed to parse JSON response`, e);
                    throw new Error(`Server returned invalid JSON (Status: ${response.status})`);
                }
            } else {
                 if (!response.ok) {
                     const textResponse = await response.text();
                     console.error(`Fetch Error (${toolPrefix}): Non-JSON response`, textResponse);
                     throw new Error(`Server returned non-JSON error (Status: ${response.status}): ${textResponse.substring(0, 100)}...`);
                 }
                 console.warn(`Fetch Warning (${toolPrefix}): Received non-JSON response but status was OK.`);
                  hideLoading(toolPrefix);
                  return { unexpectedSuccess: true };
            }

            if (!response.ok) {
                const errorMsg = responseData?.error || responseData?.details || response.statusText || `HTTP error! Status: ${response.status}`;
                throw new Error(errorMsg);
            }

             hideLoading(toolPrefix);
            return responseData;

        } catch (error) {
            console.error(`Fetch Error (${toolPrefix}):`, error);
            let displayError = error.message;
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                 displayError = 'Network error: Could not connect to the server. Is it running?';
            }
            showError(toolPrefix, displayError || 'Request failed. Check console for details.');
             hideLoading(toolPrefix);
            return null;
        }
    }


    // --- Tab Switching Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const currentActiveTab = document.querySelector('.tab-button.active');
            const currentActiveContent = document.querySelector('.tab-content.active');
            if (currentActiveTab) currentActiveTab.classList.remove('active');
            if (currentActiveContent) currentActiveContent.classList.remove('active');

            tab.classList.add('active');
            const contentId = tab.dataset.tab;
            const newActiveContent = document.getElementById(contentId);
            if (newActiveContent) newActiveContent.classList.add('active');
             console.log(`Switched to tab: ${contentId}`);
        });
    });

    // --- Tool: Text Corrector ---
    const correctorButton = document.getElementById('corrector-button');
    const textToCorrect = document.getElementById('text-to-correct');
    const correctedText = document.getElementById('corrected-text');
    const correctionFeedback = document.getElementById('correction-feedback');
    const correctorOutputDiv = document.getElementById('corrector-output');

    if (correctorButton) {
        correctorButton.addEventListener('click', async () => {
            const text = textToCorrect.value.trim();
            if (!text) {
                showError('corrector', 'Please enter text to correct.');
                return;
            }
            clearOutput('corrector');

            const result = await fetchData('/correct', { text: text }, 'corrector');

            if (result && !result.error) {
                let hasContent = false;
                const correctedTextArea = document.getElementById('corrected-text-area');
                const feedbackArea = document.getElementById('correction-feedback-area');

                if (result.corrected_text && !result.corrected_text.toLowerCase().includes("error")) {
                     if (correctedText) correctedText.textContent = result.corrected_text;
                    if (correctedTextArea) correctedTextArea.style.display = 'block';
                    hasContent = true;
                } else {
                    if (correctedTextArea) correctedTextArea.style.display = 'none';
                    console.log("No valid corrected text received.");
                }

                if (result.feedback && Array.isArray(result.feedback) && result.feedback.length > 0) {
                     if (correctionFeedback) {
                         correctionFeedback.innerHTML = '';
                         result.feedback.forEach(item => {
                             const li = document.createElement('li');
                             const mistake = item.mistake ? `"${item.mistake.replace(/</g, "<")}"` : '(General issue)';
                             const correction = item.correction ? `"${item.correction.replace(/</g, "<")}"` : '(See explanation)';
                             const explanation = item.explanation ? item.explanation.replace(/</g, "<") : 'No explanation provided.';
                             li.innerHTML = `<strong>Mistake:</strong> ${mistake}<br><strong>Correction:</strong> ${correction}<br><strong>Explanation:</strong> ${explanation}`;
                             correctionFeedback.appendChild(li);
                         });
                        if (feedbackArea) feedbackArea.style.display = 'block';
                        hasContent = true;
                    }
                } else {
                    if (feedbackArea) feedbackArea.style.display = 'none';
                     console.log("No feedback items received.");
                }

                 if(hasContent) {
                     displayOutput('corrector');
                 } else if (!result.corrected_text?.toLowerCase().includes("error")) {
                       if (correctedText) correctedText.textContent = text;
                       if (correctedTextArea) correctedTextArea.style.display = 'block';
                       if (correctionFeedback) correctionFeedback.innerHTML = '<li>No corrections needed or identified.</li>';
                       if (feedbackArea) feedbackArea.style.display = 'block';
                      displayOutput('corrector');
                 } else {
                     showError('corrector', result.corrected_text || 'Received empty response from server.');
                 }

            } else if (result && result.error) {
                 showError('corrector', result.error + (result.details ? ` Details: ${result.details}` : ''));
            }
        });
    } else { console.error("Corrector button not found"); }


    // --- Tool: Topic Generator ---
    const topicLevelSelect = document.getElementById('topic-level');
    const topicSelect = document.getElementById('topic-select');
    const generateTopicButton = document.getElementById('topic-generator-button');
    const topicExplanationDiv = document.getElementById('topic-explanation');
    const topicQuestionsForm = document.getElementById('topic-questions-form');
    const checkTopicAnswersButton = document.getElementById('check-topic-answers-button');
    const topicFeedbackDiv = document.getElementById('topic-feedback');

    function populateTopics() {
        if (!topicLevelSelect || !topicSelect) return;
        const selectedLevel = topicLevelSelect.value;
        const topics = grammarTopicsData[selectedLevel] || [];
        topicSelect.innerHTML = '';
        if (topics.length === 0) {
             const option = document.createElement('option');
             option.textContent = "No topics for this level";
             option.disabled = true;
             topicSelect.appendChild(option);
        } else {
            topics.forEach(topic => {
                const option = document.createElement('option');
                option.value = topic;
                option.textContent = topic;
                topicSelect.appendChild(option);
            });
        }
    }

    if (topicLevelSelect) topicLevelSelect.addEventListener('change', populateTopics);
    populateTopics();

    if (generateTopicButton) {
        generateTopicButton.addEventListener('click', async () => {
            if (!topicSelect || !topicLevelSelect) return;
            const topic = topicSelect.value;
            const level = topicLevelSelect.value;
            if (!topic || topic === "No topics for this level") {
                 showError('topic-generator', 'Please select a valid topic.');
                return;
            }
            clearOutput('topic-generator');
            topicQuestions = [];

            const result = await fetchData('/generate_topic', { topic: topic, level: level }, 'topic-generator');

            if (result && !result.error) {
                if (topicExplanationDiv) topicExplanationDiv.innerHTML = result.explanation_html || '<p>No explanation generated.</p>';
                if (topicQuestionsForm) topicQuestionsForm.innerHTML = '';
                if (topicFeedbackDiv) topicFeedbackDiv.innerHTML = '';
                topicQuestions = result.questions || [];

                if (Array.isArray(topicQuestions) && topicQuestions.length > 0) {
                    topicQuestions.forEach(q => {
                        const questionDiv = document.createElement('div');
                        questionDiv.classList.add('question-item');
                        questionDiv.dataset.questionId = q.id;
                        questionDiv.innerHTML = `<p>${q.question_html || 'Question text missing.'}</p><span class="question-feedback" id="feedback-${q.id}"></span><hr class="question-divider">`;
                        if (topicQuestionsForm) topicQuestionsForm.appendChild(questionDiv);
                    });
                    if (checkTopicAnswersButton) checkTopicAnswersButton.style.display = 'inline-block';
                } else {
                    if (topicQuestionsForm) topicQuestionsForm.innerHTML = '<p>No interactive questions generated for this topic.</p>';
                    if (checkTopicAnswersButton) checkTopicAnswersButton.style.display = 'none';
                }
                displayOutput('topic-generator');
            } else if (result && result.error) {
                showError('topic-generator', result.error + (result.details ? ` Details: ${result.details}` : ''));
            }
        });
    } else { console.error("Topic Generator button not found"); }


    if (checkTopicAnswersButton) {
        checkTopicAnswersButton.addEventListener('click', () => {
            if (topicFeedbackDiv) topicFeedbackDiv.innerHTML = '';
            let correctCount = 0;
            let answeredCount = 0;

            if (!Array.isArray(topicQuestions) || topicQuestions.length === 0) {
                 if (topicFeedbackDiv) topicFeedbackDiv.textContent = "No questions to check.";
                 return;
            }

            topicQuestions.forEach(q => {
                const questionDiv = topicQuestionsForm ? topicQuestionsForm.querySelector(`.question-item[data-question-id='${q.id}']`) : null;
                const feedbackSpan = document.getElementById(`feedback-${q.id}`);

                if (!feedbackSpan) { console.warn(`Feedback span not found for question ID: ${q.id}`); return; }
                if (!questionDiv) { console.warn(`Question container div not found for question ID: ${q.id}`); feedbackSpan.textContent = ' (Error: Question container missing)'; feedbackSpan.className = 'question-feedback incorrect'; return; }

                let userAnswer = null;

                if (q.type === "multiple-choice") {
                    const checkedRadio = questionDiv.querySelector(`input[name='${q.id}']:checked`);
                    userAnswer = checkedRadio ? checkedRadio.value : null;
                } else if (q.type === "fill-in-the-blank") {
                    const inputElement = questionDiv.querySelector(`input[type='text']`);
                    userAnswer = inputElement ? inputElement.value : null;
                } else if (q.type === "true-false") {
                     const checkedRadio = questionDiv.querySelector(`input[name='${q.id}']:checked`);
                     userAnswer = checkedRadio ? checkedRadio.value : null;
                }

                if (userAnswer !== null) {
                    const userAnswerTrimmed = userAnswer.trim();
                    if (userAnswerTrimmed !== '') {
                        answeredCount++;
                        const isCorrect = q.answer !== null && userAnswerTrimmed.toLowerCase() === String(q.answer).toLowerCase();
                        if (isCorrect) {
                            feedbackSpan.textContent = ' ✓ Correct';
                            feedbackSpan.className = 'question-feedback correct';
                            correctCount++;
                        } else {
                            feedbackSpan.textContent = ` ✗ Incorrect (Correct: ${q.answer})`;
                            feedbackSpan.className = 'question-feedback incorrect';
                        }
                    } else {
                         feedbackSpan.textContent = ' (Answered empty)';
                         feedbackSpan.className = 'question-feedback incorrect';
                    }
                } else {
                    feedbackSpan.textContent = ' (Not answered)';
                    feedbackSpan.className = 'question-feedback';
                }
            });

            if (topicFeedbackDiv) {
                const summary = document.createElement('p');
                summary.style.marginTop = '1em';
                summary.style.fontWeight = 'bold';
                if (answeredCount === 0 && topicQuestions.length > 0) {
                     summary.textContent = "Please answer the questions first.";
                } else if (topicQuestions.length === 0) {
                     summary.textContent = "No questions to summarize.";
                } else {
                    summary.textContent = `You got ${correctCount} out of ${topicQuestions.length} correct (${answeredCount} answered).`;
                    if (correctCount === topicQuestions.length) summary.textContent += " Great job!";
                }
                topicFeedbackDiv.appendChild(summary);
            }
        });
    } else { console.error("Check Topic Answers button not found"); }


    // --- Tool: Vocabulary Helper ---
    const vocabButton = document.getElementById('vocab-helper-button');
    const wordInput = document.getElementById('word-input');
    const vocabOutput = document.getElementById('vocab-helper-output');

     if (vocabButton && wordInput) {
        vocabButton.addEventListener('click', async () => {
            const word = wordInput.value.trim();
            if (!word) { showError('vocab-helper', 'Please enter a word.'); return; }
            clearOutput('vocab-helper');
            const result = await fetchData('/vocabulary', { word: word }, 'vocab-helper');
            if (result && !result.error) {
                 if (vocabOutput) {
                     let formattedHtml = result.info_html || 'Could not retrieve information.';
                     formattedHtml = formattedHtml.replace(/### (.*?)\n/g, '<h3>$1</h3>');
                     formattedHtml = formattedHtml.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                     formattedHtml = formattedHtml.replace(/^\* (.*?)$/gm, '<li>$1</li>');
                     vocabOutput.innerHTML = formattedHtml;
                     displayOutput('vocab-helper');
                 }
            } else if (result && result.error) {
                showError('vocab-helper', result.error + (result.details ? ` Details: ${result.details}` : ''));
            }
        });
         wordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); vocabButton.click(); } });
    } else { console.error("Vocabulary Helper button or input not found"); }


    // --- Tool: Paraphraser ---
    const paraphraseButton = document.getElementById('paraphraser-button');
    const textToParaphrase = document.getElementById('text-to-paraphrase');
    const paraphraseStyle = document.getElementById('paraphrase-style');
    const paraphraseList = document.getElementById('paraphrase-list');
    const paraphraseOutputDiv = document.getElementById('paraphraser-output');

    if (paraphraseButton && textToParaphrase && paraphraseStyle) {
        paraphraseButton.addEventListener('click', async () => {
            const text = textToParaphrase.value.trim();
            const style = paraphraseStyle.value;
            if (!text) { showError('paraphraser', 'Please enter text to paraphrase.'); return; }
            clearOutput('paraphraser');
            const result = await fetchData('/paraphrase', { text: text, style: style }, 'paraphraser');
            if (result && !result.error && result.paraphrases && Array.isArray(result.paraphrases)) {
                 if (paraphraseList) {
                    paraphraseList.innerHTML = '';
                     if (result.paraphrases.length > 0) {
                         result.paraphrases.forEach(p => { const li = document.createElement('li'); li.textContent = p; paraphraseList.appendChild(li); });
                     } else { paraphraseList.innerHTML = '<li>No paraphrased versions generated.</li>'; }
                 }
                 if (paraphraseOutputDiv && !paraphraseOutputDiv.querySelector('h3')) { const h3 = document.createElement('h3'); h3.textContent = "Paraphrased Versions:"; paraphraseOutputDiv.prepend(h3); }
                 displayOutput('paraphraser');
            } else if (result && result.error) {
                showError('paraphraser', result.error + (result.details ? ` Details: ${result.details}` : ''));
            } else {
                 showError('paraphraser', 'Could not generate or parse paraphrases.');
                 if (paraphraseList) paraphraseList.innerHTML = '';
            }
        });
    } else { console.error("Paraphraser elements (button, textarea, select) not found"); }


    // --- Tool: Level-Based Text Generator ---
     const levelGenLevelSelect = document.getElementById('level-gen-level');
     const generateLevelTextButton = document.getElementById('level-generator-button');
     const levelGenTextDiv = document.getElementById('level-gen-text');
     const levelGenQuestionsForm = document.getElementById('level-gen-questions-form');
     const checkLevelGenAnswersButton = document.getElementById('check-level-gen-answers-button');
     const levelGenFeedbackDiv = document.getElementById('level-gen-feedback');

     if(generateLevelTextButton && levelGenLevelSelect) {
         generateLevelTextButton.addEventListener('click', async () => {
            if (!levelGenLevelSelect) return;
             const level = levelGenLevelSelect.value;
             clearOutput('level-generator');
             levelGenQuestions = [];
             const result = await fetchData('/generate_level_text', { level: level }, 'level-generator');
             if (result && !result.error) {
                if (levelGenTextDiv) levelGenTextDiv.innerHTML = result.text_html || '<p>No text generated.</p>';
                if (levelGenQuestionsForm) levelGenQuestionsForm.innerHTML = '';
                if (levelGenFeedbackDiv) levelGenFeedbackDiv.innerHTML = '';
                levelGenQuestions = result.questions || [];
                if (Array.isArray(levelGenQuestions) && levelGenQuestions.length > 0) {
                    levelGenQuestions.forEach(q => {
                        const questionDiv = document.createElement('div');
                        questionDiv.classList.add('question-item');
                        questionDiv.dataset.questionId = q.id;
                         questionDiv.innerHTML = `<p>${q.question_html || 'Question text missing.'}</p><span class="question-feedback" id="feedback-${q.id}"></span><hr class="question-divider">`;
                         if (levelGenQuestionsForm) levelGenQuestionsForm.appendChild(questionDiv);
                    });
                    if (checkLevelGenAnswersButton) checkLevelGenAnswersButton.style.display = 'inline-block';
                } else {
                    if (levelGenQuestionsForm) levelGenQuestionsForm.innerHTML = '<p>No interactive questions generated for this text.</p>';
                    if (checkLevelGenAnswersButton) checkLevelGenAnswersButton.style.display = 'none';
                }
                 displayOutput('level-generator');
             } else if (result && result.error) {
                 showError('level-generator', result.error + (result.details ? ` Details: ${result.details}` : ''));
             }
         });
     } else { console.error("Level Generator button or select not found"); }


     if (checkLevelGenAnswersButton) {
         checkLevelGenAnswersButton.addEventListener('click', () => {
            if (levelGenFeedbackDiv) levelGenFeedbackDiv.innerHTML = '';
            let correctCount = 0;
            let answeredCount = 0;
             if (!Array.isArray(levelGenQuestions) || levelGenQuestions.length === 0) {
                 if (levelGenFeedbackDiv) levelGenFeedbackDiv.textContent = "No questions to check.";
                 return;
            }
            levelGenQuestions.forEach(q => {
                const questionDiv = levelGenQuestionsForm ? levelGenQuestionsForm.querySelector(`.question-item[data-question-id='${q.id}']`) : null;
                const feedbackSpan = document.getElementById(`feedback-${q.id}`);
                if (!feedbackSpan) { console.warn(`Feedback span not found for question ID: ${q.id}`); return; }
                if (!questionDiv) { console.warn(`Question container div not found for question ID: ${q.id}`); feedbackSpan.textContent = ' (Error: Question container missing)'; feedbackSpan.className = 'question-feedback incorrect'; return; }
                let userAnswer = null;
                if (q.type === "multiple-choice") {
                    const checkedRadio = questionDiv.querySelector(`input[name='${q.id}']:checked`);
                    userAnswer = checkedRadio ? checkedRadio.value : null;
                } else if (q.type === "fill-in-the-blank") {
                    const inputElement = questionDiv.querySelector(`input[type='text']`);
                    userAnswer = inputElement ? inputElement.value : null;
                } else if (q.type === "true-false") {
                     const checkedRadio = questionDiv.querySelector(`input[name='${q.id}']:checked`);
                     userAnswer = checkedRadio ? checkedRadio.value : null;
                 } else {
                     console.warn(`Unknown or missing question type for ID: ${q.id}. Attempting fallback.`);
                     const textInput = questionDiv.querySelector(`input[type='text']`);
                     const checkedRadio = questionDiv.querySelector(`input[name='${q.id}']:checked`);
                     if (textInput) userAnswer = textInput.value; else if (checkedRadio) userAnswer = checkedRadio.value;
                 }
                if (userAnswer !== null) {
                    const userAnswerTrimmed = userAnswer.trim();
                    if (userAnswerTrimmed !== '') {
                        answeredCount++;
                        const isCorrect = q.answer !== null && userAnswerTrimmed.toLowerCase() === String(q.answer).toLowerCase();
                        if (isCorrect) { feedbackSpan.textContent = ' ✓ Correct'; feedbackSpan.className = 'question-feedback correct'; correctCount++; }
                        else { feedbackSpan.textContent = ` ✗ Incorrect (Correct: ${q.answer})`; feedbackSpan.className = 'question-feedback incorrect'; }
                    } else { feedbackSpan.textContent = ' (Answered empty)'; feedbackSpan.className = 'question-feedback incorrect'; }
                } else { feedbackSpan.textContent = ' (Not answered)'; feedbackSpan.className = 'question-feedback'; }
             });
             if (levelGenFeedbackDiv) {
                const summary = document.createElement('p');
                 summary.style.marginTop = '1em'; summary.style.fontWeight = 'bold';
                  if (answeredCount === 0 && levelGenQuestions.length > 0) { summary.textContent = "Please answer the questions first."; }
                  else if (levelGenQuestions.length === 0) { summary.textContent = "No questions to summarize."; }
                  else { summary.textContent = `You got ${correctCount} out of ${levelGenQuestions.length} correct (${answeredCount} answered).`; if (correctCount === levelGenQuestions.length) summary.textContent += " Excellent!"; }
                 levelGenFeedbackDiv.appendChild(summary);
            }
         });
     } else { console.error("Check Level Gen Answers button not found"); }


    // --- Chatbot Logic ---
    const chatBubble = document.getElementById('chat-bubble');
    const chatWindow = document.getElementById('chat-window');
    const closeChatButton = document.getElementById('close-chat');
    const sendChatButton = document.getElementById('send-chat-button');

    function addChatMessage(message, sender) {
        if (!chatHistory) return;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
         const safeMessage = message.replace(/</g, "<").replace(/>/g, ">");
         messageDiv.textContent = safeMessage;
        if (sender === 'bot' && elevenlabsClientAvailable && safeMessage && !safeMessage.toLowerCase().startsWith("error:")) {
             messageDiv.classList.add('speakable');
             messageDiv.dataset.textToSpeak = message; // Store original message
             const icon = document.createElement('i');
             icon.className = 'fas fa-volume-up tts-icon';
             icon.title = 'Play audio';
             messageDiv.appendChild(icon);
        }
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }

    // --- MODIFICATION START: handleSendMessage to include auto-play ---
    async function handleSendMessage() {
        if (!chatInput || !fetchData) return;
        const message = chatInput.value.trim();
        // Allow sending only if there's a message OR if STT just finished (isRecording will be false then)
        // This prevents sending empty messages manually but allows STT results to be sent.
        if (!message || (isRecording && message === '')) return; // Prevent sending empty or while recording manually

        // If the message came from STT, it might already be in the input. Add it as user message.
        // Avoid adding duplicates if user typed and hit send quickly after STT.
        // Check if the last message was already this text (simple check)
        const lastUserMessage = chatHistory.querySelector('.user-message:last-child');
        if (!lastUserMessage || lastUserMessage.textContent !== message) {
             addChatMessage(message, 'user');
        }

        chatInput.value = ''; // Clear input after capturing message
        showLoading('chat');

        const result = await fetchData('/chat', { message: message }, 'chat');

        // hideLoading('chat') is called by fetchData

        if (result && result.reply) {
            addChatMessage(result.reply, 'bot'); // Add reply to UI

            // --- Auto-play TTS ---
            // Check conditions: TTS available and reply is not an error
            if (elevenlabsClientAvailable && !result.reply.toLowerCase().startsWith("error:")) {
                console.log("Auto-playing TTS for bot reply.");
                playTTS(result.reply); // Call the TTS function
            } else {
                if (!elevenlabsClientAvailable) console.log("Skipping auto-play: TTS not available.");
                if (result.reply.toLowerCase().startsWith("error:")) console.log("Skipping auto-play: Bot reply is an error message.");
            }
            // --- End Auto-play TTS ---

        } else if (result && result.error) {
            const errorMsg = result.reply || result.error || 'Sorry, I encountered an error.';
             addChatMessage(errorMsg, 'bot');
             showError('chat', errorMsg);
        } else if (!result) {
             addChatMessage('Sorry, no response received from the server.', 'bot');
             // Error shown by fetchData
        }
    }
    // --- MODIFICATION END: handleSendMessage ---

    if (chatBubble) {
        chatBubble.addEventListener('click', () => {
            if (chatWindow) chatWindow.style.display = 'flex';
            chatBubble.style.display = 'none';
        });
    }

    if (closeChatButton) {
        closeChatButton.addEventListener('click', () => {
            if (chatWindow) chatWindow.style.display = 'none';
            if (chatBubble) chatBubble.style.display = 'flex';
             if (ttsAudio && !ttsAudio.paused) { ttsAudio.pause(); ttsAudio.currentTime = 0; }
             if (recognition && isRecording) { recognition.stop(); }
        });
    }

    if (sendChatButton && chatInput) {
        sendChatButton.addEventListener('click', handleSendMessage);
        chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } });
    }

    // --- Chatbot STT (Speech Recognition) ---
    if (speechRecognitionSupported && micButton) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        micButton.addEventListener('click', () => {
             clearError('chat');
            if (isRecording) {
                recognition.stop();
                console.log("STT stopped by user.");
            } else {
                 try {
                    recognition.start();
                    console.log("STT started.");
                 } catch(err) {
                      console.error("STT start error:", err); showError('chat', `Mic start failed: ${err.message}`);
                      isRecording = false; micButton.classList.remove('recording'); const micIcon = micButton.querySelector('i'); if (micIcon) micIcon.className = 'fas fa-microphone'; micButton.title = "Use Microphone"; if (chatInput) chatInput.placeholder = "Type your message or use mic...";
                 }
            }
        });

        recognition.onstart = () => {
            isRecording = true; micButton.classList.add('recording'); const micIcon = micButton.querySelector('i'); if (micIcon) micIcon.className = 'fas fa-stop-circle'; micButton.title = "Stop Recording"; if (chatInput) { chatInput.value = ""; chatInput.placeholder = "Listening..."; }
            // Disable send button while recording
            if (sendChatButton) sendChatButton.disabled = true;
        };

        // --- MODIFICATION START: onresult to ensure auto-send ---
        recognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            console.log("STT result:", speechResult);
            if (chatInput) {
                chatInput.value = speechResult; // Put text in input for user to see
            }
            // recognition.stop(); // Stop recognition explicitly once we have a result (optional, onspeechend might cover it)

            // Call handleSendMessage IMMEDIATELY with the result
            // handleSendMessage will capture chatInput.value
            console.log("STT result obtained, calling handleSendMessage automatically.");
             handleSendMessage();
        };
        // --- MODIFICATION END: onresult ---

        recognition.onspeechend = () => {
            console.log("STT speech ended. Waiting for final result.");
            // Don't necessarily stop immediately, wait for onresult or onend
            // recognition.stop(); // Might stop too early before onresult fires
        };

        recognition.onend = () => {
            console.log("STT recognition session ended.");
            isRecording = false;
            micButton.classList.remove('recording');
             const micIcon = micButton.querySelector('i');
             if (micIcon) micIcon.className = 'fas fa-microphone';
             micButton.title = "Use Microphone";
             if (chatInput) chatInput.placeholder = "Type your message or use mic...";
             // Re-enable send button and mic button (if not disabled by loading state)
             if (sendChatButton && !document.getElementById('chat-loading').style.display === 'block') sendChatButton.disabled = false;
             if (micButton && !document.getElementById('chat-loading').style.display === 'block') micButton.disabled = false;

        };

        recognition.onerror = (event) => {
            console.error('Speech Recognition Error:', event.error, event.message);
            let errorMsg = event.error;
            if (event.error === 'no-speech') { errorMsg = 'No speech detected. Please try speaking clearly.'; }
            else if (event.error === 'audio-capture') { errorMsg = 'Microphone error. Ensure it is connected, enabled, and not used by another app.'; }
            else if (event.error === 'not-allowed') { errorMsg = 'Microphone access denied. Please allow access in browser settings and refresh.'; }
            else if (event.error === 'network') { errorMsg = 'Network error during speech recognition.'; }
            else { errorMsg = `Mic error: ${event.message || event.error}`; }
            showError('chat', errorMsg);
             if (isRecording) {
                  try { recognition.abort(); } catch(e){ console.error("Error aborting STT:", e); }
                  isRecording = false; micButton.classList.remove('recording'); const micIcon = micButton.querySelector('i'); if (micIcon) micIcon.className = 'fas fa-microphone'; micButton.title = "Use Microphone"; if (chatInput) chatInput.placeholder = "Type your message or use mic...";
                   // Re-enable buttons on error too
                   if (sendChatButton) sendChatButton.disabled = false;
                   if (micButton) micButton.disabled = false;
             }
        };

    } else {
        console.warn("Speech Recognition API not supported or Mic button not found.");
        if(micButton) micButton.style.display = 'none';
    }


    // --- Chatbot TTS (Text-to-Speech) ---
     console.log("Initializing TTS checks. Client available:", elevenlabsClientAvailable);

     async function playTTS(text) {
         if (!text || !elevenlabsClientAvailable || (ttsAudio && !ttsAudio.paused)) {
             console.log(`Skipping TTS. Text: ${!!text}, Available: ${elevenlabsClientAvailable}, Playing: ${ttsAudio ? !ttsAudio.paused : 'N/A'}`);
             if (ttsAudio && !ttsAudio.paused) { /* Don't show error if already playing */ }
             else if (!elevenlabsClientAvailable) { showError('chat', 'TTS service is not available.'); }
             return;
         }
         if (!ttsAudio) { console.error("TTS Audio element not found."); showError('chat', 'Internal error: Audio player missing.'); return; }

          console.log("Requesting TTS synthesis for:", text.substring(0,50) + "...");
          showLoading('chat'); // Show loading indicator during fetch/playback
          clearError('chat');

         try {
             const response = await fetch('/synthesize', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
                 body: JSON.stringify({ text: text })
             });

             if (!response.ok) {
                  let errorDetail = `TTS generation failed with status ${response.status}`;
                  try { const errData = await response.json(); errorDetail = errData.error || errorDetail; } catch(e) { /* Ignore */ }
                  throw new Error(errorDetail);
             }

             const audioBlob = await response.blob();
             if (!audioBlob || audioBlob.size === 0) { throw new Error("Received empty audio data."); }
             const audioUrl = URL.createObjectURL(audioBlob);

             ttsAudio.src = audioUrl;
             ttsAudio.play()
                 .then(() => { console.log("TTS playback started."); hideLoading('chat'); }) // Hide loading *after* playback starts successfully
                 .catch(err => { console.error("TTS playback error:", err); showError('chat', `Could not play audio: ${err.message}`); hideLoading('chat'); try { URL.revokeObjectURL(audioUrl); } catch(e) {} });

             ttsAudio.onended = () => { console.log("TTS playback finished."); try { URL.revokeObjectURL(audioUrl); } catch(e) {} hideLoading('chat'); }; // Ensure loading hidden on end
             ttsAudio.onerror = (err) => { console.error("TTS Audio Element Error:", ttsAudio.error); showError('chat', `Audio playback error code: ${ttsAudio.error?.code}`); hideLoading('chat'); try { URL.revokeObjectURL(audioUrl); } catch(e) {} };

         } catch (error) {
             console.error("TTS Fetch/Setup Error:", error); showError('chat', `TTS failed: ${error.message}`); hideLoading('chat');
         }
     }

     // Event listener for clicking TTS icons (for replaying)
     if (chatHistory) {
         chatHistory.addEventListener('click', (event) => {
             if (event.target.classList.contains('tts-icon')) {
                  const messageDiv = event.target.closest('.bot-message.speakable');
                 if (messageDiv) {
                     const text = messageDiv.dataset.textToSpeak;
                      console.log("TTS icon clicked for replay:", text ? text.substring(0,30)+"..." : "No text found");
                      if (text) {
                          // If already playing, maybe stop first? Or just let playTTS handle it
                          if (ttsAudio && !ttsAudio.paused) {
                              ttsAudio.pause();
                              ttsAudio.currentTime = 0;
                              // Add a small delay before playing again if needed
                              setTimeout(() => playTTS(text), 100);
                          } else {
                               playTTS(text);
                          }
                      } else { showError('chat', 'Could not find text for TTS replay.'); }
                 }
             }
         });
     }

    console.log("English Learning Suite Initialized.");

}); // End DOMContentLoaded