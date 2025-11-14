/* ====================  DOM CACHE  ==================== */
const els = {
  questionPad   : document.getElementById('question_pad'),
  answerPad     : document.getElementById('answer_pad'),
  questionAns   : document.getElementById('question_answers'),
  timer         : document.getElementById('timer'),
  result        : document.getElementById('result'),
  score         : document.getElementById('score'),
  totalTime     : document.getElementById('total_time'),
  retryBtn      : document.getElementById('retry_btn'),
  cancelBtn     : document.getElementById('cancel_btn'),
  startScreen   : document.getElementById('start_screen'),
  startBtn      : document.getElementById('start_btn'),
  quitBtn       : document.getElementById('quit_btn'),
  container     : document.querySelector('.container')
};

/* ====================  STATE  ==================== */
let allQs = [], selQs = [], idx = 0, curQ = null;
let correct = 0, quizStart = 0, qStart = 0, timerId = null, active = false;
let dragged = null;               // the block being dragged
let offsetX = 0, offsetY = 0;     // finger offset inside the block

/* ====================  FETCH QUESTIONS  ==================== */
fetch('questions.json')
  .then(r => r.ok ? r.json() : Promise.reject('Load error'))
  .then(d => { allQs = d.easy || []; showStart(); })
  .catch(e => { els.questionPad.textContent = 'Error: ' + e; console.error(e); });

/* ====================  UTILS  ==================== */
const shuffle = a => { for (let i = a.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const fmt = n => (n < 10 ? '0' : '') + n;

/* ====================  TIMER  ==================== */
const startTimer = () => {
  clearInterval(timerId);
  qStart = Date.now();
  timerId = setInterval(() => {
    const sec = Math.floor((Date.now() - qStart) / 1000);
    els.timer.textContent = `Time: ${sec}s`;
  }, 1000);
};
const stopTimer = () => clearInterval(timerId);

/* ====================  START / END  ==================== */
function showStart() {
  active = false; stopTimer(); els.timer.style.display = 'none';
  els.startScreen.style.display = 'block';
  els.result.style.display = 'none';
  els.questionPad.textContent = 'Ready to code? Have fun!';
}
function startQuiz() {
  if (allQs.length < 20) return alert('Need at least 20 questions');
  selQs = shuffle([...allQs]).slice(0,20);
  active = true; idx = 0; correct = 0; quizStart = Date.now();
  els.startScreen.style.display = 'none';
  els.timer.style.display = 'block';
  els.result.style.display = 'none';
  startTimer(); loadQ(0);
}
function endQuiz() {
  if (!active) return;
  active = false; stopTimer();
  const total = Math.floor((Date.now() - quizStart) / 1000);
  const m = Math.floor(total / 60), s = total % 60;
  els.score.textContent = `Score: ${correct} / 20`;
  els.totalTime.textContent = `Time: ${m}m ${fmt(s)}s`;
  els.result.style.display = 'block';
  els.questionPad.textContent = 'Quiz Complete!';
  els.answerPad.innerHTML = '';
  els.questionAns.innerHTML = '';
  els.timer.style.display = 'none';
}

/* ====================  QUESTION RENDER  ==================== */
function loadQ(i) {
  if (i >= selQs.length || !active) return endQuiz();
  curQ = selQs[i];
  els.questionPad.textContent = curQ.question;
  els.answerPad.innerHTML = '';
  els.questionAns.innerHTML = '';
  startTimer();

  // ----- answer blocks -----
  curQ.answers.forEach((txt, n) => {
    const b = document.createElement('div');
    b.className = 'answer-block';
    b.textContent = txt;
    b.dataset.idx = n;
    b.draggable = true;
    els.answerPad.appendChild(b);
    initDrag(b);
  });

  // ----- slots -----
  for (let n = 0; n < curQ.answer_divs; n++) {
    const s = document.createElement('div');
    s.className = 'slot';
    s.textContent = `Drop answer ${n + 1} here`;
    s.dataset.slot = n;
    // allow drop on every slot
    s.addEventListener('dragover', e => e.preventDefault());
    s.addEventListener('drop', e => dropHandler(e));
    els.questionAns.appendChild(s);
  }

  // allow dropping back into answer pad
  els.answerPad.addEventListener('dragover', e => e.preventDefault());
  els.answerPad.addEventListener('drop', e => dropHandler(e, true));
}

/* ====================  DRAG INITIALISATION  ==================== */
function initDrag(el) {
  /* ---- MOUSE (desktop fallback) ---- */
  el.addEventListener('dragstart', e => {
    dragged = el;
    el.classList.add('dragging');
    e.dataTransfer.setData('text/plain', el.dataset.idx);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragged = null;
  });

  /* ---- TOUCH ---- */
  el.addEventListener('touchstart', e => {
    const touch = e.touches[0];
    const rect = el.getBoundingClientRect();
    offsetX = touch.clientX - rect.left;
    offsetY = touch.clientY - rect.top;
    dragged = el;
    el.classList.add('dragging');
    el.style.pointerEvents = 'none';   // let events pass through to slots
    e.preventDefault();
  }, {passive:false});

  el.addEventListener('touchmove', e => {
    if (!dragged) return;
    e.preventDefault();
    const touch = e.touches[0];
    const x = touch.clientX - offsetX;
    const y = touch.clientY - offsetY;
    dragged.style.transform = `translate(${x}px, ${y}px)`;
    dragged.style.zIndex = '1000';
  }, {passive:false});

  el.addEventListener('touchend', e => {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    dragged.style.transform = '';
    dragged.style.zIndex = '';
    dragged.style.pointerEvents = '';

    // find element under finger
    const touch = e.changedTouches[0];
    const under = document.elementFromPoint(touch.clientX, touch.clientY);
    const slot = under?.closest('.slot');
    if (slot) dropHandler({target: slot});
    else dropHandler({target: els.answerPad}, true);

    dragged = null;
  });
}

/* ====================  DROP HANDLER  ==================== */
function dropHandler(e, toPad = false) {
  e.preventDefault();
  if (!dragged) return;

  if (toPad) {
    els.answerPad.appendChild(dragged);
    return;
  }

  const slot = e.target.closest('.slot');
  if (!slot || slot.children.length) return;   // occupied

  slot.textContent = '';
  slot.appendChild(dragged);

  // check if all slots filled
  const filled = els.questionAns.querySelectorAll('.slot .answer-block').length;
  const total  = els.questionAns.querySelectorAll('.slot').length;
  if (filled === total) setTimeout(checkAnswer, 300);
}

/* ====================  ANSWER CHECK  ==================== */
function checkAnswer() {
  const order = Array.from(els.questionAns.querySelectorAll('.slot')).map(s => {
    const b = s.querySelector('.answer-block');
    return b ? +b.dataset.idx : -1;
  });
  const ok = JSON.stringify(order) === JSON.stringify(curQ.correct_order);

  if (ok) {
    correct++; idx++;
    setTimeout(() => loadQ(idx), 600);
  } else {
    els.questionAns.classList.add('shake');
    setTimeout(() => {
      els.questionAns.classList.remove('shake');
      els.questionAns.querySelectorAll('.answer-block').forEach(b => els.answerPad.appendChild(b));
      els.questionAns.querySelectorAll('.slot').forEach((s, i) => s.textContent = `Drop answer ${i+1} here`);
    }, 600);
  }
}

/* ====================  CONFIRM DIALOG  ==================== */
async function confirm(msg) {
  return new Promise(res => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:9999;`;
    const box = document.createElement('div');
    box.style.cssText = `background:rgba(12,18,28,.95);padding:20px 30px;border-radius:10px;color:#14ffec;text-align:center;font-family:'Fira Code',monospace;box-shadow:0 0 18px rgba(20,255,236,.3);`;
    box.innerHTML = `
      <p style="margin-bottom:14px;">${msg}</p>
      <button id="yes" style="margin-right:10px;background:#14ffec;color:#0b0f19;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;">Yes</button>
      <button id="no" style="background:#ff416c;color:#fff;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;">No</button>`;
    overlay.appendChild(box); document.body.appendChild(overlay);
    box.querySelector('#yes').onclick = () => { overlay.remove(); res(true); };
    box.querySelector('#no').onclick  = () => { overlay.remove(); res(false); };
  });
}

/* ====================  GOODBYE SCREEN  ==================== */
function goodbye() {
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;color:#14ffec;font-family:'Fira Code',monospace;background:radial-gradient(circle at 20% 20%,#0b0f19 0%,#02060f 100%);text-align:center;">
      <h2>Thanks for playing!</h2>
      <p>Come back soon!</p>
      <button id="restart" style="margin-top:16px;padding:12px 20px;background:linear-gradient(90deg,#14ffec,#0d7377);color:#0b0f19;border:none;border-radius:8px;cursor:pointer;">Restart</button>
    </div>`;
  document.getElementById('restart').onclick = showStart;
}

/* ====================  EVENT BINDINGS  ==================== */
els.startBtn.addEventListener('click', startQuiz);
els.retryBtn.addEventListener('click', startQuiz);
els.cancelBtn.addEventListener('click', async () => (await confirm('Restart?')) && showStart());
els.quitBtn.addEventListener('click', async () => (await confirm('Quit the game?')) && goodbye());

/* ====================  CURSOR GLOW (desktop)  ==================== */
document.addEventListener('mousemove', e => {
  const g = document.querySelector('.cursor-glow');
  g.style.left = e.pageX + 'px';
  g.style.top  = e.pageY + 'px';
});

/* ====================  INITIAL CALL  ==================== */
showStart();
