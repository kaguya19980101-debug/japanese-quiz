// --- 變數設定 ---
const TOTAL_QUESTIONS = 20; // 總題數
const POINTS_PER_Q = 5;     // 一題幾分

let shuffledQuestions = []; // 洗牌後的題庫
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null; // 使用者目前選了哪個答案

// --- DOM 抓取元素 ---
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const resultScreen = document.getElementById('result-screen');

const questionEl = document.getElementById('question');
const answerButtonsEl = document.getElementById('answer-buttons');
const progressText = document.getElementById('progress-text');
const scoreText = document.getElementById('score-text');
const finalScoreEl = document.getElementById('final-score');

const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

// --- 事件監聽 ---
startBtn.addEventListener('click', startGame);
submitBtn.addEventListener('click', submitAnswer);
nextBtn.onclick = () => {
    currentQuestionIndex++;
    setNextQuestion();
};
restartBtn.addEventListener('click', startGame);

// --- 函數區 ---

function startGame() {
    // 1. 隱藏其他畫面，顯示遊戲畫面
    startScreen.classList.add('hide');
    resultScreen.classList.add('hide');
    gameScreen.classList.remove('hide');

    // 2. 初始化變數
    score = 0;
    currentQuestionIndex = 0;
    scoreText.innerText = `得分: ${score}`;

// 新增這一段 (修復重新開始時的按鈕 Bug) 
    nextBtn.innerText = "下一題"; 
    nextBtn.onclick = () => {
        currentQuestionIndex++;
        setNextQuestion();
    };

    // 3. 題庫洗牌並取出前 20 題 (如果題庫不夠 20 題，就取全部)
    // sort(() => Math.random() - 0.5) 是最簡單的陣列亂數排序法
    shuffledQuestions = questionBank.sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);

    setNextQuestion();
}

function setNextQuestion() {
    resetState(); // 清空上一題的按鈕
    showQuestion(shuffledQuestions[currentQuestionIndex]);
}

function showQuestion(questionData) {
    // 顯示進度
    progressText.innerText = `第 ${currentQuestionIndex + 1} / ${shuffledQuestions.length} 題`;
    
    // 顯示題目
    questionEl.innerText = questionData.q;

    // ★ 修改重點開始 ★
    
    // 1. 複製一份選項清單 (用 [...] 語法)，避免動到原本的題庫資料
    // 2. 對這份複製品進行洗牌 (跟洗題目一樣用 random - 0.5)
    let randomOptions = [...questionData.options].sort(() => Math.random() - 0.5);

    // 3. 使用洗牌後的 "randomOptions" 來產生按鈕，而不是原本的 questionData.options
    randomOptions.forEach(option => {
        const button = document.createElement('button');
        button.innerText = option;
        button.classList.add('option-btn');
        
        // 點擊選項時的動作
        button.addEventListener('click', () => selectOption(button));
        
        answerButtonsEl.appendChild(button);
    });

    // ★ 修改重點結束 ★
}
function resetState() {
    // 隱藏下一題按鈕，顯示送出按鈕
    nextBtn.classList.add('hide');
    submitBtn.classList.remove('hide');
    submitBtn.disabled = true; // 沒選答案前不能送出
    selectedOption = null;
    
    // 清除舊的選項按鈕
    while (answerButtonsEl.firstChild) {
        answerButtonsEl.removeChild(answerButtonsEl.firstChild);
    }
}

function selectOption(btn) {
    // 先把大家選取的樣子取消
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.classList.remove('selected'));

    // 把目前點的這個加上 selected
    btn.classList.add('selected');
    selectedOption = btn; // 記住使用者選了哪個按鈕 DOM

    // 解鎖送出按鈕
    submitBtn.disabled = false;
}

function submitAnswer() {
    // 取得正確答案文字
    const correctAns = shuffledQuestions[currentQuestionIndex].answer;
    const userAns = selectedOption.innerText;
    
    // 鎖定所有按鈕，不准再改
    const allBtns = document.querySelectorAll('.option-btn');
    allBtns.forEach(btn => btn.disabled = true);

    // --- 判斷邏輯 ---
    if (userAns === correctAns) {
        // 答對了！
        score += POINTS_PER_Q;
        scoreText.innerText = `得分: ${score}`;
        selectedOption.classList.add('correct'); // 變綠色
    } else {
        // 答錯了！
        selectedOption.classList.add('wrong'); // 變紅色
        
        // ★ 也要把正確答案標示出來讓使用者知道
        allBtns.forEach(btn => {
            if (btn.innerText === correctAns) {
                btn.classList.add('correct'); // 正確答案變綠
            }
        });
    }

    // 切換按鈕：隱藏「送出」，顯示「下一題」或「看結果」
    submitBtn.classList.add('hide');
    
    if (shuffledQuestions.length > currentQuestionIndex + 1) {
        nextBtn.classList.remove('hide');
    } else {
        // 已經是最後一題，改顯示結束按鈕 (這裡我們直接偷懶用下一題按鈕改成結算功能，或直接跳轉)
        // 為了簡單，我們創建一個臨時的 "看成績" 按鈕，或是直接改 nextBtn 的文字
        nextBtn.innerText = "查看成績";
        nextBtn.classList.remove('hide');
        
        // 覆寫 nextBtn 的行為變成 showResults (注意：要小心 removeEventListener，這裡最簡單是用另一個變數判斷)
        nextBtn.onclick = showResults; 
    }
}

function showResults() {
    gameScreen.classList.add('hide');
    resultScreen.classList.remove('hide');
    finalScoreEl.innerText = `${score} 分`;
    
    // ★ 新增：遊戲結束時，自動把分數傳給 Google 試算表
    sendDataToGoogleSheet(score);

    // 把 nextBtn 改回來 (為了下一局)
    nextBtn.innerText = "下一題";
    nextBtn.onclick = () => {
        currentQuestionIndex++;
        setNextQuestion();
    };
}

// ★ 新增這個函式：負責把資料丟給 GAS
function sendDataToGoogleSheet(finalScore) {
    // 1. 請填入你剛剛重新部署拿到的 GAS 網址
    const scriptURL = "https://script.google.com/macros/s/AKfycbzQsKfyNKpWFdEWMl-tfgqA_Zd_tzOcW1BtjyzXUzmGBJoylK3gEO4HLmNWXfpWMfIu8w/exec"; 

    // 2. 準備要傳送的資料
    let formData = new FormData();
    formData.append('score', finalScore + " / 100"); // 傳送分數 (例如: 80 / 100)
    formData.append('time', new Date().toLocaleString()); // 傳送目前時間

    // 3. 使用 fetch 發送
    fetch(scriptURL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors' // 重要！這行可以避免跨網域錯誤 (CORS error)
    })
    .then(() => {
        console.log("成績已成功傳送至 Google 試算表！");
        // 你也可以在這裡加一個 alert('成績已上傳！');
    })
    .catch(error => {
        console.error('傳送失敗:', error);
    });
}