const TOTAL_QUESTIONS = 20;
const POINTS_PER_Q = 5;
const STORAGE_KEY = 'my_mistakes';
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzQsKfyNKpWFdEWMl-tfgqA_Zd_tzOcW1BtjyzXUzmGBJoylK3gEO4HLmNWXfpWMfIu8w/exec';

let shuffledQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let currentUserName = '';
let wrongAnswers = [];
let isReviewMode = false;

function loadMistakes() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

let savedMistakes = loadMistakes();
const $ = id => document.getElementById(id);
const startScreen = $('start-screen');
const gameScreen = $('game-screen');
const resultScreen = $('result-screen');
const usernameInput = $('username');
const answerButtonsEl = $('answer-buttons');
const submitBtn = $('submit-btn');
const nextBtn = $('next-btn');

function saveMistakes() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMistakes)); }
    catch (error) { console.warn('錯題暫時無法儲存', error); }
}

function shuffle(items) {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function showScreen(screen) {
    [startScreen, gameScreen, resultScreen].forEach(element => element.classList.toggle('hide', element !== screen));
    window.scrollTo(0, 0);
}

function updateReviewButton() {
    $('review-btn').classList.toggle('hide', savedMistakes.length === 0);
    $('wrong-count').textContent = savedMistakes.length;
}

function getName() {
    const name = usernameInput.value.trim();
    $('start-error').classList.toggle('hide', !!name);
    if (!name) { usernameInput.focus(); return null; }
    currentUserName = name;
    return name;
}

function startGame() {
    if (!getName()) return;
    const selectedLevel = document.querySelector('input[name="level"]:checked').value;
    const filteredBank = selectedLevel === 'ALL'
        ? questionBank
        : questionBank.filter(question => question.nLevel === selectedLevel);
    if (!filteredBank.length) return;

    isReviewMode = false;
    shuffledQuestions = shuffle(filteredBank).slice(0, TOTAL_QUESTIONS);
    $('mode-label').textContent = selectedLevel === 'ALL' ? '混合挑戰' : `${selectedLevel} 挑戰`;
    initGame();
}

function startReviewMode() {
    if (!getName()) return;
    if (!savedMistakes.length) return;
    isReviewMode = true;
    shuffledQuestions = shuffle(savedMistakes);
    $('mode-label').textContent = '錯題複習';
    initGame();
}

function initGame() {
    score = 0;
    currentQuestionIndex = 0;
    wrongAnswers = [];
    $('score-text').textContent = '目前 0 分';
    $('perfect-score-img').classList.add('hide');
    $('review-container').classList.add('hide');
    showScreen(gameScreen);
    showQuestion();
}

function showQuestion() {
    const question = shuffledQuestions[currentQuestionIndex];
    const count = shuffledQuestions.length;
    const number = currentQuestionIndex + 1;
    selectedOption = null;
    answerButtonsEl.replaceChildren();
    $('question').textContent = question.q;
    $('progress-text').textContent = `第 ${number} / ${count} 題`;
    $('progress-percent').textContent = `${Math.round(number / count * 100)}%`;
    $('progress-fill').style.width = `${number / count * 100}%`;
    $('progress-track').setAttribute('aria-valuemax', count);
    $('progress-track').setAttribute('aria-valuenow', number);
    $('answer-feedback').className = 'answer-feedback hide';
    $('answer-feedback').textContent = '';
    submitBtn.disabled = true;
    submitBtn.classList.remove('hide');
    nextBtn.classList.add('hide');

    shuffle(question.options).forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'option-btn';
        button.dataset.answer = option;
        const letter = document.createElement('span');
        letter.className = 'option-letter';
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = 'ABCD'[index] || String(index + 1);
        const label = document.createElement('span');
        label.className = 'option-label';
        label.textContent = option;
        button.append(letter, label);
        button.addEventListener('click', () => selectOption(button));
        answerButtonsEl.appendChild(button);
    });
}

function selectOption(button) {
    if (button.disabled) return;
    answerButtonsEl.querySelectorAll('.option-btn').forEach(option => option.classList.remove('selected'));
    button.classList.add('selected');
    selectedOption = button;
    submitBtn.disabled = false;
}

function submitAnswer() {
    if (!selectedOption) return;
    const question = shuffledQuestions[currentQuestionIndex];
    const correctAnswer = question.answer.split('(')[0].trim();
    const userAnswer = selectedOption.dataset.answer;
    const correct = userAnswer === correctAnswer;
    const feedback = $('answer-feedback');

    answerButtonsEl.querySelectorAll('.option-btn').forEach(button => {
        button.disabled = true;
        if (button.dataset.answer === correctAnswer) button.classList.add('correct');
    });
    feedback.classList.remove('hide');
    feedback.classList.add(correct ? 'is-correct' : 'is-wrong');

    if (correct) {
        score += POINTS_PER_Q;
        $('score-text').textContent = `目前 ${score} 分`;
        feedback.textContent = '答對了！繼續保持 ✨';
        if (isReviewMode) {
            savedMistakes = savedMistakes.filter(item => item.q !== question.q);
            saveMistakes();
        }
    } else {
        selectedOption.classList.add('wrong');
        feedback.textContent = `再記住一次：${question.answer}`;
        if (!wrongAnswers.some(item => item.q === question.q)) {
            wrongAnswers.push({ ...question, userWrongAns: userAnswer });
        }
    }

    submitBtn.classList.add('hide');
    nextBtn.classList.remove('hide');
    nextBtn.innerHTML = currentQuestionIndex === shuffledQuestions.length - 1
        ? '查看成績 <span aria-hidden="true">→</span>'
        : '下一題 <span aria-hidden="true">→</span>';
}

function nextQuestion() {
    if (currentQuestionIndex === shuffledQuestions.length - 1) {
        showResults();
    } else {
        currentQuestionIndex++;
        showQuestion();
    }
}

function addReviewLine(item, className, label, value) {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = `${label}${value}`;
    item.appendChild(element);
}

function showResults() {
    const count = shuffledQuestions.length;
    const fullScore = count * POINTS_PER_Q;
    const correctCount = count - wrongAnswers.length;
    $('final-score').textContent = isReviewMode ? `${correctCount} / ${count}` : score;
    $('score-total').textContent = isReviewMode ? '題答對' : `/ ${fullScore} 分`;
    $('correct-count').textContent = correctCount;
    $('result-wrong-count').textContent = wrongAnswers.length;
    $('result-message').textContent = wrongAnswers.length === 0
        ? '完美通關！今天的努力有成果了。'
        : `答對 ${correctCount} 題，再看看錯題就更熟悉了。`;

    if (!isReviewMode) sendDataToGoogleSheet(score, fullScore);
    if (wrongAnswers.length) {
        const byQuestion = new Map([...savedMistakes, ...wrongAnswers].map(item => [item.q, item]));
        savedMistakes = [...byQuestion.values()];
        saveMistakes();
    }

    const reviewList = $('review-list');
    reviewList.replaceChildren();
    $('review-container').classList.toggle('hide', wrongAnswers.length === 0);
    $('perfect-score-img').classList.toggle('hide', wrongAnswers.length !== 0);
    wrongAnswers.forEach(question => {
        const item = document.createElement('li');
        item.className = 'review-item';
        addReviewLine(item, 'review-q', 'Q. ', question.q);
        addReviewLine(item, 'review-wrong', '你選：', question.userWrongAns);
        addReviewLine(item, 'review-correct', '正解：', question.answer);
        reviewList.appendChild(item);
    });
    showScreen(resultScreen);
}

function sendDataToGoogleSheet(finalScore, fullScore) {
    const formData = new FormData();
    formData.append('score', `${finalScore} / ${fullScore}`);
    formData.append('time', new Date().toLocaleString());
    formData.append('name', currentUserName);
    fetch(SHEET_URL, { method: 'POST', body: formData, mode: 'no-cors' })
        .catch(error => console.error('成績傳送失敗：', error));
}

$('start-btn').addEventListener('click', startGame);
$('review-btn').addEventListener('click', startReviewMode);
submitBtn.addEventListener('click', submitAnswer);
nextBtn.addEventListener('click', nextQuestion);
$('restart-btn').addEventListener('click', () => { updateReviewButton(); showScreen(startScreen); });
usernameInput.addEventListener('input', () => $('start-error').classList.add('hide'));
usernameInput.addEventListener('keydown', event => { if (event.key === 'Enter') startGame(); });
updateReviewButton();
