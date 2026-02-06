// --- 變數設定 ---
const TOTAL_QUESTIONS = 20; // 總題數 
const POINTS_PER_Q = 5;     // 一題幾分

let shuffledQuestions = []; // 洗牌後的題庫
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null; // 使用者目前選了哪個答案

let currentUserName = ""; // 用來存使用者的名字
let wrongAnswers = []; // 用來存「這一輪」答錯的題目

let isReviewMode = false; // 判斷現在是不是在複習
let savedMistakes = JSON.parse(localStorage.getItem('my_mistakes')) || []; // 讀取歷史錯題

// --- DOM 抓取元素 ---
const usernameInput = document.getElementById('username'); 
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');

const questionEl = document.getElementById('question');
const answerButtonsEl = document.getElementById('answer-buttons');
const progressText = document.getElementById('progress-text');
const scoreText = document.getElementById('score-text');
const finalScoreEl = document.getElementById('final-score');

const startBtn = document.getElementById('start-btn');
const reviewBtn = document.getElementById('review-btn'); // 紅色按鈕
const wrongCountSpan = document.getElementById('wrong-count'); // 紅色按鈕上的數字
const submitBtn = document.getElementById('submit-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

// --- 初始化檢查 (網頁載入時執行) ---
if (savedMistakes.length > 0) {
    reviewBtn.classList.remove('hide');
    wrongCountSpan.innerText = savedMistakes.length;
}

// --- 事件監聽 ---
startBtn.addEventListener('click', startGame);
reviewBtn.addEventListener('click', startReviewMode); // ★ 修復：加入複習按鈕監聽
submitBtn.addEventListener('click', submitAnswer);
nextBtn.onclick = () => {
    currentQuestionIndex++;
    setNextQuestion();
};
restartBtn.addEventListener('click', goHome); // ★ 修復：改為呼叫 goHome 回首頁

// --- 函數區 ---

// 1. 普通模式開始
function startGame() {
    const nameValue = usernameInput.value.trim();
    if (nameValue === "") {
        alert("請輸入名字才能開始喔！");
        return;
    }
    currentUserName = nameValue;
    isReviewMode = false; // ★ 確保這是普通模式

    // 題庫洗牌並取出前 20 題 (確保 questionBank 存在於 questions.js)
    shuffledQuestions = questionBank.sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);

    initGameUI();
}

// 2. 複習模式開始
function startReviewMode() {
    const nameValue = usernameInput.value.trim();
    if (nameValue === "") {
        alert("請輸入名字才能開始喔！");
        return;
    }
    currentUserName = nameValue;
    isReviewMode = true; // ★ 設定為複習模式

    // 題庫來源改成「錯題本」
    shuffledQuestions = [...savedMistakes].sort(() => Math.random() - 0.5);

    initGameUI();
}

// 3. 共用介面初始化
function initGameUI() {
    // 清空變數
    score = 0;
    currentQuestionIndex = 0;
    wrongAnswers = []; 
    scoreText.innerText = `得分: 0`;

    // 隱藏檢討相關區塊
    document.getElementById('perfect-score-img').classList.add('hide');
    document.getElementById('review-container').classList.add('hide');

    // 切換畫面
    startScreen.classList.add('hide');
    resultScreen.classList.add('hide');
    gameScreen.classList.remove('hide');

    // 重置按鈕
    nextBtn.innerText = "下一題"; 
    nextBtn.onclick = () => {
        currentQuestionIndex++;
        setNextQuestion();
    };

    setNextQuestion();
}

// 4. 回到首頁 (Restart 按鈕用)
function goHome() {
    resultScreen.classList.add('hide');
    gameScreen.classList.add('hide');
    startScreen.classList.remove('hide');

    // 重新檢查錯題數量 (因為剛剛可能消滅了一些錯題)
    if (savedMistakes.length > 0) {
        reviewBtn.classList.remove('hide');
        wrongCountSpan.innerText = savedMistakes.length;
    } else {
        reviewBtn.classList.add('hide');
    }
}

function setNextQuestion() {
    resetState();
    showQuestion(shuffledQuestions[currentQuestionIndex]);
}

function showQuestion(questionData) {
    progressText.innerText = `第 ${currentQuestionIndex + 1} / ${shuffledQuestions.length} 題`;
    questionEl.innerText = questionData.q;

    // 洗牌選項
    let randomOptions = [...questionData.options].sort(() => Math.random() - 0.5);

    randomOptions.forEach(option => {
        const button = document.createElement('button');
        button.innerText = option;
        button.classList.add('option-btn');
        button.addEventListener('click', () => selectOption(button));
        answerButtonsEl.appendChild(button);
    });
}

function resetState() {
    nextBtn.classList.add('hide');
    submitBtn.classList.remove('hide');
    submitBtn.disabled = true;
    selectedOption = null;
    
    while (answerButtonsEl.firstChild) {
        answerButtonsEl.removeChild(answerButtonsEl.firstChild);
    }
}

function selectOption(btn) {
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedOption = btn;
    submitBtn.disabled = false;
}

function submitAnswer() {
    // ★ 定義 currentQ (修復報錯關鍵)
    const currentQ = shuffledQuestions[currentQuestionIndex]; 

    const correctAns = currentQ.answer;
    const userAns = selectedOption.innerText;
    
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => btn.disabled = true);

    if (userAns === correctAns) {
        // --- 答對 ---
        score += POINTS_PER_Q;
        scoreText.innerText = `得分: ${score}`;
        selectedOption.classList.add('correct');

        // ★ 若是複習模式答對 -> 從錯題本移除
        if (isReviewMode) {
            savedMistakes = savedMistakes.filter(item => item.q !== currentQ.q);
            localStorage.setItem('my_mistakes', JSON.stringify(savedMistakes));
            console.log("已從錯題本移除:", currentQ.q);
        }

    } else {
        // --- 答錯 ---
        selectedOption.classList.add('wrong');
        allBtns.forEach(btn => {
            if (btn.innerText === correctAns) btn.classList.add('correct');
        });

        // ★ 紀錄錯題 (存整題資料)
        let isExist = wrongAnswers.some(q => q.q === currentQ.q);
        if (!isExist) {
            let wrongQ = { ...currentQ }; 
            wrongQ.userWrongAns = userAns;
            wrongAnswers.push(wrongQ);
        }
    }

    submitBtn.classList.add('hide');
    
    if (shuffledQuestions.length > currentQuestionIndex + 1) {
        nextBtn.classList.remove('hide');
    } else {
        nextBtn.innerText = "查看成績";
        nextBtn.classList.remove('hide');
        nextBtn.onclick = showResults; 
    }
}

function showResults() {
    gameScreen.classList.add('hide');
    resultScreen.classList.remove('hide');
    
    // 1. 處理分數與上傳
    if (isReviewMode) {
        finalScoreEl.innerText = "複習完成！";
        if (score === shuffledQuestions.length * POINTS_PER_Q) {
             finalScoreEl.innerText = "太棒了！錯題全部清除！✨";
        }
        console.log("複習模式：不記錄成績"); 
    } else {
        finalScoreEl.innerText = `${score} 分`;
        sendDataToGoogleSheet(score);
    }

    // 2. 處理錯題儲存 (去重)
    if (wrongAnswers.length > 0) {
        let allMistakes = [...savedMistakes, ...wrongAnswers];
        
        let uniqueMistakes = [];
        const map = new Map();
        for (const item of allMistakes) {
            if(!map.has(item.q)){
                map.set(item.q, true);
                uniqueMistakes.push(item);
            }
        }
        
        localStorage.setItem('my_mistakes', JSON.stringify(uniqueMistakes));
        savedMistakes = uniqueMistakes; 
    }

    // 3. 顯示結果列表或讚讚圖
    // 這裡邏輯：顯示「這一輪」做錯的題目
    if (wrongAnswers.length === 0) {
        document.getElementById('perfect-score-img').classList.remove('hide');
        document.getElementById('review-container').classList.add('hide');
    } else {
        document.getElementById('perfect-score-img').classList.add('hide');
        const reviewContainer = document.getElementById('review-container');
        const reviewList = document.getElementById('review-list');
        
        reviewContainer.classList.remove('hide');
        reviewList.innerHTML = ''; 

        wrongAnswers.forEach(item => {
            const li = document.createElement('li');
            li.classList.add('review-item');
            li.innerHTML = `
                <span class="review-q">Q: ${item.q}</span>
                <span class="review-wrong">❌ 你選: ${item.userWrongAns}</span>
                <span class="review-correct">✅ 正解: ${item.answer}</span>
            `;
            reviewList.appendChild(li);
        });
    }
}

function sendDataToGoogleSheet(finalScore) {
    const scriptURL = "https://script.google.com/macros/s/AKfycbzQsKfyNKpWFdEWMl-tfgqA_Zd_tzOcW1BtjyzXUzmGBJoylK3gEO4HLmNWXfpWMfIu8w/exec"; 

    let formData = new FormData();
    formData.append('score', finalScore + " / 100"); 
    formData.append('time', new Date().toLocaleString());
    formData.append('name', currentUserName);
    
    fetch(scriptURL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors' 
    })
    .then(() => {
        console.log("成績已成功傳送至 Google 試算表！");
    })
    .catch(error => {
        console.error('傳送失敗:', error);
    });
}