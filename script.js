const TOTAL_QUESTIONS = 20;
const POINTS_PER_Q = 5;
const STORAGE_KEY = 'my_mistakes';
const ACTIVE_LEVELS = new Set(['N5', 'N4']);
const TOPIC_DEFINITIONS = [
    { id: 'n5_numbers', level: 'N5', name: '數字' },
    { id: 'n5_greetings', level: 'N5', name: '問候' },
    { id: 'n5_time', level: 'N5', name: '時間' },
    { id: 'n5_people', level: 'N5', name: '人物' },
    { id: 'n5_directions', level: 'N5', name: '方位' },
    { id: 'n5_actions', level: 'N5', name: '基本動作' },
    { id: 'n5_animals', level: 'N5', name: '動物' },
    { id: 'n5_colors', level: 'N5', name: '顏色' },
    { id: 'n5_nature', level: 'N5', name: '季節與自然' },
    { id: 'n4_food', level: 'N4', name: '食物' },
    { id: 'n4_life', level: 'N4', name: '生活' },
    { id: 'n4_travel', level: 'N4', name: '交通與場所' },
    { id: 'n4_descriptions', level: 'N4', name: '形容與感受' }
];
const TOPIC_NAMES = Object.fromEntries(TOPIC_DEFINITIONS.map(topic => [topic.id, topic.name]));
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbzQsKfyNKpWFdEWMl-tfgqA_Zd_tzOcW1BtjyzXUzmGBJoylK3gEO4HLmNWXfpWMfIu8w/exec';

let shuffledQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let currentUserName = '';
let currentUserId = '';
let currentAttemptId = '';
let wrongAnswers = [];
let isReviewMode = false;
let settingsSnapshot = null;

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
const historyScreen = $('history-screen');
const gachaScreen = $('gacha-screen');
const usernameInput = $('username');
const playerIdInput = $('player-id');
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
    [startScreen, gameScreen, resultScreen, historyScreen, gachaScreen].forEach(element => element.classList.toggle('hide', element !== screen));
    $('nav-wrap').classList.toggle('hide', screen === gameScreen || screen === resultScreen);
    closeNavMenu();
    window.scrollTo(0, 0);
}

function closeNavMenu() {
    $('nav-menu').classList.add('hide');
    $('nav-menu-toggle').setAttribute('aria-expanded', 'false');
}

let gachaViewToken = 0;
let gachaState = null;
let selectedDrawId = null;
function operationId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

async function postAndConfirm(fields, isConfirmed) {
    const body = new FormData();
    Object.entries(fields).forEach(([key, value]) => body.append(key, value));
    try { await fetch(SHEET_URL, {method: 'POST', body, mode: 'no-cors'}); }
    catch (error) { console.warn('送出結果無法確認', error); }
    for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 650));
        try {
            const state = await readHistory(fields.playerId);
            if (isConfirmed(state)) return state;
        } catch (error) { console.warn('讀取確認中', error); }
    }
    throw new Error('尚未確認寫入，請稍後重新開啟查看。');
}

function renderRewards(state) {
    gachaState = state;
    $('gacha-points').textContent = state.stats.points;
    $('gacha-spin-btn').disabled = state.stats.points < 5 || !state.prizesAvailable;
    $('reward-count').textContent = `（${state.rewards.length}）`;
    const list = $('reward-list');
    list.replaceChildren();
    if (!state.rewards.length) {
        const empty = document.createElement('li');
        empty.textContent = '還沒有抽獎紀錄。';
        list.appendChild(empty);
    }
    state.rewards.forEach(reward => {
        const item = document.createElement('li');
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = reward.prize;
        const time = document.createElement('small');
        time.textContent = reward.time;
        info.append(title, time);
        item.appendChild(info);
        if (reward.status === '已核發') {
            const badge = document.createElement('span');
            badge.className = 'issued';
            badge.textContent = '已核發';
            item.appendChild(badge);
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = '管理者確認核發';
            button.addEventListener('click', () => openIssue(reward));
            item.appendChild(button);
        }
        list.appendChild(item);
    });
}

function setRewardListOpen(open) {
    $('reward-list').classList.toggle('hide', !open);
    $('reward-toggle').setAttribute('aria-expanded', String(open));
}

async function openGacha() {
    if (!getName()) return;
    const view = ++gachaViewToken;
    if ($('gacha-win-dialog').open) $('gacha-win-dialog').close();
    setRewardListOpen(false);
    $('gacha-machine').classList.remove('spinning');
    $('gacha-result').textContent = '正在讀取點數…';
    $('gacha-spin-btn').disabled = true;
    showScreen(gachaScreen);
    try {
        const state = await readHistory(currentUserId);
        if (view !== gachaViewToken) return;
        renderRewards(state);
        $('gacha-result').textContent = !state.prizesAvailable ? '請先在獎勵設定表填入獎品。'
            : state.stats.points < 5 ? '累積 5 點就可以扭蛋！' : '可以扭蛋囉！';
    } catch (error) {
        if (view === gachaViewToken) $('gacha-result').textContent = error.message;
    }
}

function showDrawSuccess(state, drawId) {
    const reward = state.rewards.find(item => item.drawId === drawId);
    if (!reward) return false;
    renderRewards(state);
    $('gacha-result').textContent = `抽到「${reward.prize}」！已加入我的獎勵清單。`;
    $('gacha-win-prize').textContent = reward.prize;
    if (!$('gacha-win-dialog').open) $('gacha-win-dialog').showModal();
    return true;
}

async function spinGacha() {
    const machine = $('gacha-machine');
    if ($('gacha-spin-btn').disabled || !gachaState || gachaState.stats.points < 5) return;
    const view = gachaViewToken;
    const drawId = operationId();
    machine.classList.remove('spinning');
    void machine.offsetWidth;
    machine.classList.add('spinning');
    $('gacha-result').textContent = '扭蛋轉動中…';
    $('gacha-spin-btn').disabled = true;
    try {
        const [state] = await Promise.all([
            postAndConfirm({action: 'draw', playerId: currentUserId, drawId}, result => result.rewards.some(item => item.drawId === drawId)),
            new Promise(resolve => setTimeout(resolve, 2050))
        ]);
        if (view !== gachaViewToken) return;
        showDrawSuccess(state, drawId);
    } catch (error) {
        if (view === gachaViewToken) {
            try {
                const state = await readHistory(currentUserId);
                if (view !== gachaViewToken) return;
                if (showDrawSuccess(state, drawId)) return;
                renderRewards(state);
            } catch (_) { /* 保持目前顯示 */ }
            $('gacha-spin-btn').disabled = true;
            $('gacha-result').textContent = `${error.message} 請重新開啟扭蛋頁確認，避免重複扣點。`;
        }
    }
}

function openIssue(reward) {
    selectedDrawId = reward.drawId;
    $('issue-reward-name').textContent = reward.prize;
    $('issue-pin').value = '';
    $('issue-error').classList.add('hide');
    $('issue-dialog').showModal();
}

async function confirmIssue() {
    const pin = $('issue-pin').value;
    if (!pin || !selectedDrawId) return;
    $('issue-confirm').disabled = true;
    $('issue-error').classList.add('hide');
    try {
        const state = await postAndConfirm({action: 'issue', playerId: currentUserId, drawId: selectedDrawId, pin},
            result => result.rewards.some(item => item.drawId === selectedDrawId && item.status === '已核發'));
        $('issue-dialog').close();
        renderRewards(state);
    } catch (_) {
        $('issue-error').textContent = '核發未確認，請檢查管理碼或稍後重試。';
        $('issue-error').classList.remove('hide');
    } finally {
        $('issue-pin').value = '';
        $('issue-confirm').disabled = false;
    }
}

let historyRequestNumber = 0;
let historyViewToken = 0;
function readHistory(playerId) {
    return new Promise((resolve, reject) => {
        const callbackName = `__quizHistory_${Date.now()}_${++historyRequestNumber}`;
        const script = document.createElement('script');
        const url = new URL(SHEET_URL);
        url.searchParams.set('action', 'history');
        url.searchParams.set('playerId', playerId);
        url.searchParams.set('callback', callbackName);
        let timer;
        let settled = false;
        const clean = () => {
            clearTimeout(timer);
            script.remove();
            delete window[callbackName];
        };
        window[callbackName] = result => {
            if (settled) return;
            settled = true;
            clean();
            result && result.ok ? resolve(result) : reject(new Error(result?.error || '無法讀取歷史數據'));
        };
        script.onerror = () => {
            if (settled) return;
            settled = true;
            clean();
            reject(new Error('讀取失敗，請檢查試算表程式是否已部署'));
        };
        timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            clean();
            reject(new Error('讀取逾時，請確認試算表程式已加入歷史數據功能'));
        }, 12000);
        script.src = url.toString();
        document.head.appendChild(script);
    });
}

function renderHistory(result) {
    const stats = result.stats;
    $('history-attempts').textContent = stats.attempts;
    $('history-week').textContent = stats.week;
    $('history-today').textContent = stats.today;
    $('history-perfect').textContent = stats.perfect;
    $('history-earned').textContent = stats.earned ?? '—';
    $('history-spent').textContent = stats.spent ?? '—';
    $('history-points').textContent = stats.points;
    const list = $('history-list');
    list.replaceChildren();
    result.records.forEach(record => {
        const item = document.createElement('li');
        const date = document.createElement('span');
        const scoreText = document.createElement('strong');
        date.textContent = record.time || '未記錄日期';
        scoreText.textContent = record.score || '未記錄成績';
        item.append(date, scoreText);
        list.appendChild(item);
    });
    $('history-content').classList.toggle('hide', stats.attempts === 0);
    $('history-status').textContent = stats.attempts ? '' : '還沒有完成的測驗紀錄，來挑戰第一回吧！';
}

async function showHistory() {
    const name = getName();
    if (!name) return;
    const request = ++historyViewToken;
    $('history-name').textContent = `${name}（${currentUserId}）的練習紀錄`;
    $('history-status').textContent = '正在讀取紀錄…';
    $('history-content').classList.add('hide');
    showScreen(historyScreen);
    try {
        const result = await readHistory(currentUserId);
        if (request === historyViewToken) renderHistory(result);
    } catch (error) {
        if (request === historyViewToken) $('history-status').textContent = error.message;
    }
}

function currentLevel() {
    return document.querySelector('input[name="level"]:checked').value;
}

function renderTopics() {
    for (const topic of TOPIC_DEFINITIONS) {
        const label = document.createElement('label');
        label.className = 'topic-choice';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'topic';
        input.value = topic.id;
        input.dataset.level = topic.level;
        input.checked = true;
        input.addEventListener('change', updateTopicSelection);
        const card = document.createElement('span');
        card.className = 'topic-card';
        const check = document.createElement('span');
        check.className = 'topic-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';
        const name = document.createElement('strong');
        name.className = 'topic-name';
        name.textContent = topic.name;
        const count = document.createElement('span');
        count.className = 'topic-count';
        count.textContent = `${questionBank.filter(question => question.topic === topic.id).length} 題`;
        card.append(check, name, count);
        label.append(input, card);
        $(topic.level === 'N5' ? 'n5-topic-grid' : 'n4-topic-grid').appendChild(label);
    }
}

function selectedTopics(level = currentLevel()) {
    return new Set([...document.querySelectorAll('input[name="topic"]:checked')]
        .filter(input => level === 'N4' || input.dataset.level === 'N5')
        .map(input => input.value));
}

function eligibleQuestions(level, topics) {
    return questionBank.filter(question =>
        (level === 'N4' ? ACTIVE_LEVELS.has(question.nLevel) : question.nLevel === 'N5') &&
        topics.has(question.topic)
    );
}

function reviewQuestions() {
    const available = new Map(eligibleQuestions(currentLevel(), selectedTopics()).map(question => [question.q, question]));
    return savedMistakes.filter(item => available.has(item.q))
        .map(item => ({ ...available.get(item.q), userWrongAns: item.userWrongAns }));
}

function updateReviewButton() {
    const count = reviewQuestions().length;
    $('review-btn').classList.toggle('hide', count === 0);
    $('wrong-count').textContent = count;
}

function updateTopicSelection() {
    const selected = selectedTopics();
    const level = currentLevel();
    $('n4-topic-section').classList.toggle('hide', level === 'N5');
    const available = eligibleQuestions(level, selected).length;
    $('settings-count').textContent = `已選 ${selected.size} 個主題，可抽 ${available} 題`;
    $('topic-error').classList.toggle('hide', selected.size > 0);
}

function updateSettingsSummary() {
    const selected = selectedTopics();
    const available = eligibleQuestions(currentLevel(), selected).length;
    $('settings-summary').textContent = currentLevel() === 'N4' ? 'N4 挑戰（含 N5）' : 'N5 入門';
    $('topic-selection-summary').textContent = `${selected.size} 個主題・題庫 ${available} 題`;
    updateReviewButton();
}

function openSettings() {
    settingsSnapshot = {
        level: currentLevel(),
        topics: new Set([...document.querySelectorAll('input[name="topic"]:checked')].map(input => input.value))
    };
    updateTopicSelection();
    $('settings-dialog').showModal();
}

function closeSettings(save) {
    if (save && selectedTopics().size === 0) {
        $('topic-error').classList.remove('hide');
        return;
    }
    if (!save && settingsSnapshot) {
        document.querySelector(`input[name="level"][value="${settingsSnapshot.level}"]`).checked = true;
        document.querySelectorAll('input[name="topic"]').forEach(input => {
            input.checked = settingsSnapshot.topics.has(input.value);
        });
    }
    updateTopicSelection();
    if (save) updateSettingsSummary();
    $('settings-dialog').close();
    settingsSnapshot = null;
}

function getName() {
    const name = usernameInput.value.trim();
    const id = playerIdInput.value.trim();
    const valid = !!name && /^[A-Za-z0-9_-]{3,24}$/.test(id);
    $('start-error').classList.toggle('hide', valid);
    if (!valid) { (name ? playerIdInput : usernameInput).focus(); return null; }
    currentUserName = name;
    currentUserId = id;
    return name;
}

function startGame() {
    const topics = selectedTopics();
    if (!topics.size) { openSettings(); $('topic-error').classList.remove('hide'); return; }
    if (!getName()) return;
    const selectedLevel = currentLevel();
    const filteredBank = eligibleQuestions(selectedLevel, topics);
    if (!filteredBank.length) return;

    isReviewMode = false;
    shuffledQuestions = shuffle(filteredBank).slice(0, TOTAL_QUESTIONS);
    const topicLabel = topics.size === 1 ? TOPIC_NAMES[[...topics][0]] : `${topics.size} 主題`;
    $('mode-label').textContent = `${selectedLevel === 'N4' ? 'N5 + N4' : 'N5'}｜${topicLabel}`;
    initGame();
}

function startReviewMode() {
    if (!getName()) return;
    const activeMistakes = reviewQuestions();
    if (!activeMistakes.length) return;
    isReviewMode = true;
    shuffledQuestions = shuffle(activeMistakes);
    $('mode-label').textContent = '錯題複習';
    initGame();
}

function initGame() {
    score = 0;
    currentQuestionIndex = 0;
    wrongAnswers = [];
    currentAttemptId = operationId();
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
    $('answer-feedback').classList.add('hide');
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

    $('result-save-status').textContent = isReviewMode ? '' : '成績同步中…';
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

async function sendDataToGoogleSheet(finalScore, fullScore) {
    const attemptId = currentAttemptId;
    try {
        const state = await postAndConfirm({action: 'score', score: `${finalScore} / ${fullScore}`,
            name: currentUserName, playerId: currentUserId, attemptId},
            result => result.records.some(item => item.attemptId === attemptId));
        if (resultScreen.classList.contains('hide')) return;
        $('result-save-status').textContent = finalScore >= 80
            ? `成績已記錄，獲得 1 點！目前 ${state.stats.points} 點。`
            : '成績已記錄，達 80 分可獲得 1 點。';
    } catch (_) {
        if (!resultScreen.classList.contains('hide')) $('result-save-status').textContent = '尚未確認寫入，請稍後到統計查看。';
    }
}

$('start-btn').addEventListener('click', startGame);
$('nav-menu-toggle').addEventListener('click', () => {
    const opening = $('nav-menu').classList.contains('hide');
    $('nav-menu').classList.toggle('hide', !opening);
    $('nav-menu-toggle').setAttribute('aria-expanded', String(opening));
});
$('menu-history').addEventListener('click', showHistory);
$('menu-gacha').addEventListener('click', openGacha);
$('gacha-spin-btn').addEventListener('click', spinGacha);
$('reward-toggle').addEventListener('click', () => {
    setRewardListOpen($('reward-list').classList.contains('hide'));
});
$('gacha-win-close').addEventListener('click', () => {
    $('gacha-win-dialog').close();
    setRewardListOpen(true);
    $('reward-section').scrollIntoView({behavior: 'smooth', block: 'start'});
});
$('gacha-back-btn').addEventListener('click', () => {
    ++gachaViewToken;
    showScreen(startScreen);
});
$('issue-cancel').addEventListener('click', () => $('issue-dialog').close());
$('issue-confirm').addEventListener('click', confirmIssue);
$('history-back-btn').addEventListener('click', () => { ++historyViewToken; showScreen(startScreen); });
document.addEventListener('click', event => {
    if (!$('nav-wrap').contains(event.target)) closeNavMenu();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeNavMenu();
});
$('review-btn').addEventListener('click', startReviewMode);
submitBtn.addEventListener('click', submitAnswer);
nextBtn.addEventListener('click', nextQuestion);
$('restart-btn').addEventListener('click', () => { updateReviewButton(); showScreen(startScreen); });
usernameInput.addEventListener('input', () => $('start-error').classList.add('hide'));
playerIdInput.addEventListener('input', () => $('start-error').classList.add('hide'));
usernameInput.addEventListener('keydown', event => { if (event.key === 'Enter') startGame(); });
document.querySelectorAll('input[name="level"]').forEach(input => input.addEventListener('change', updateTopicSelection));
$('open-settings').addEventListener('click', openSettings);
$('save-settings').addEventListener('click', () => closeSettings(true));
$('cancel-settings').addEventListener('click', () => closeSettings(false));
$('close-settings').addEventListener('click', () => closeSettings(false));
$('settings-dialog').addEventListener('cancel', event => { event.preventDefault(); closeSettings(false); });
$('settings-dialog').addEventListener('click', event => {
    if (event.target === $('settings-dialog')) closeSettings(false);
});
$('select-all-topics').addEventListener('click', () => {
    document.querySelectorAll('input[name="topic"]').forEach(input => {
        if (currentLevel() === 'N4' || input.dataset.level === 'N5') input.checked = true;
    });
    updateTopicSelection();
});
renderTopics();
updateTopicSelection();
updateSettingsSummary();
