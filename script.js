/* -----------------------
   Utilities & Unicode
   ----------------------- */
const UNICODE = {
  "p":"♟","r":"♜","n":"♞","b":"♝","q":"♛","k":"♚",
  "P":"♙","R":"♖","N":"♘","B":"♗","Q":"♕","K":"♔"
};
const idxToFR = i => ({ f: i % 8, r: Math.floor(i / 8) });
const FRToIdx = (f,r) => r*8 + f;
const inside = (f,r) => f>=0 && f<8 && r>=0 && r<8;
const cloneArray = a => a.slice();

/* -----------------------
   Full game state
   ----------------------- */
const START_BOARD =
  "RNBQKBNR" +
  "PPPPPPPP" +
  "........" +
  "........" +
  "........" +
  "........" +
  "pppppppp" +
  "rnbqkbnr";

let board, sideToMove, canCastleWK, canCastleWQ, canCastleBK, canCastleBQ, enPassant, moveHistory;
let whiteTime, blackTime, timerInterval = null;
let lastFrom = -1, lastTo = -1;

/* -----------------------
   INIT
   ----------------------- */
function resetGame() {
  board = START_BOARD.split("");
  sideToMove = "w";
  canCastleWK = canCastleWQ = canCastleBK = canCastleBQ = true;
  enPassant = null;
  moveHistory = [];
  lastFrom = -1; lastTo = -1;
  drawBoard();
  updateStatus("Game reset.");
  clearInterval(timerInterval);
  document.getElementById("timers").style.display = "none";
  document.getElementById("chessboard").style.display = "none";
}
resetGame();

/* -----------------------
   Draw Board
   ----------------------- */
function drawBoard() {
  const boardEl = document.getElementById("chessboard");
  boardEl.innerHTML = "";
  for (let r=7;r>=0;r--) {
    for (let f=0;f<8;f++) {
      const idx = FRToIdx(f,r);
      const sq = document.createElement("div");
      sq.className = "square " + ((f+r)%2===0?"light":"dark");
      sq.dataset.idx = idx;
      if (idx === lastFrom || idx === lastTo) sq.classList.add("last-move");
      let p = board[idx];
      if (p !== ".") {
        const pe = document.createElement("div");
        pe.className = "piece";
        pe.textContent = UNICODE[p];
        pe.draggable = true;
        pe.dataset.piece = p;
        pe.dataset.idx = idx;
        sq.appendChild(pe);
      }
      boardEl.appendChild(sq);
    }
  }
  addDragHandlers();
}

/* -----------------------
   Status Update
   ----------------------- */
function updateStatus(msg) {
  document.getElementById("status").textContent = msg;
}

/* -----------------------
   Timers
   ----------------------- */
function startGame(mode) {
  if (mode==="blitz") { whiteTime=blackTime=180; }
  else if (mode==="rapid") { whiteTime=blackTime=600; }
  else { whiteTime=blackTime=1800; }

  sideToMove="w";
  canCastleWK=canCastleWQ=canCastleBK=canCastleBQ=true;
  enPassant=null; moveHistory=[];
  board=START_BOARD.split("");
  lastFrom=lastTo=-1;
  drawBoard();
  updateStatus("Game started. White to move.");
  document.getElementById("chessboard").style.display="grid";
  document.getElementById("timers").style.display="block";

  clearInterval(timerInterval);
  timerInterval=setInterval(tick,1000);
  renderTimers();
}

function tick(){
  if (sideToMove==="w") whiteTime--; else blackTime--;
  renderTimers();
  if (whiteTime<=0) {endGame("Black wins on time.");}
  if (blackTime<=0) {endGame("White wins on time.");}
}

function renderTimers(){
  document.getElementById("whiteTimer").textContent=formatTime(whiteTime);
  document.getElementById("blackTimer").textContent=formatTime(blackTime);
}
function formatTime(sec){
  let m=Math.floor(sec/60);
  let s=sec%60;
  return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
}

/* -----------------------
   Move Generation
   ----------------------- */
function generateMoves(idx){
  const moves=[];
  const p=board[idx];
  if (p===".") return moves;
  const isWhite=(p===p.toUpperCase());
  if ((sideToMove==="w")!==isWhite) return moves;
  const {f,r}=idxToFR(idx);

  const add=(nf,nr,special)=>{
    if(!inside(nf,nr)) return;
    const nidx=FRToIdx(nf,nr);
    const t=board[nidx];
    if(t==="."){ moves.push({from:idx,to:nidx,special}); return true; }
    const tIsWhite=(t===t.toUpperCase());
    if(tIsWhite!==isWhite) moves.push({from:idx,to:nidx,special});
    return false;
  };

  switch(p.toLowerCase()){
    case "p":
      let dir=isWhite?1:-1;
      let nr=r+dir;
      if(inside(f,nr)&&board[FRToIdx(f,nr)]==="."){
        moves.push({from:idx,to:FRToIdx(f,nr)});
        if((isWhite&&r===1)||(!isWhite&&r===6)){
          nr=r+2*dir;
          if(board[FRToIdx(f,nr)]===".") moves.push({from:idx,to:FRToIdx(f,nr),special:"double"});
        }
      }
      for(let df of[-1,1]){
        let nf=f+df;
        nr=r+dir;
        if(inside(nf,nr)){
          let nidx=FRToIdx(nf,nr);
          if(board[nidx]!=="."&&(board[nidx]===board[nidx].toUpperCase())!==isWhite){
            moves.push({from:idx,to:nidx});
          }
        }
      }
      if(enPassant){
        let ep=idxToFR(enPassant);
        if(ep.r===r+dir && Math.abs(ep.f-f)===1) moves.push({from:idx,to:enPassant,special:"ep"});
      }
      break;
    case "n":
      for(let [df,dr] of[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]){
        let nf=f+df,nr=r+dr;
        if(!inside(nf,nr)) continue;
        let nidx=FRToIdx(nf,nr);
        if(board[nidx]==="."||((board[nidx]===board[nidx].toUpperCase())!==isWhite)){
          moves.push({from:idx,to:nidx});
        }
      }
      break;
    case "b":
      for(let [df,dr] of[[1,1],[-1,1],[1,-1],[-1,-1]]){
        let nf=f,nr=r;
        while(true){
          nf+=df; nr+=dr;
          if(!inside(nf,nr)) break;
          let nidx=FRToIdx(nf,nr);
          if(board[nidx]===".") moves.push({from:idx,to:nidx});
          else{
            if((board[nidx]===board[nidx].toUpperCase())!==isWhite) moves.push({from:idx,to:nidx});
            break;
          }
        }
      }
      break;
    case "r":
      for(let [df,dr] of[[1,0],[-1,0],[0,1],[0,-1]]){
        let nf=f,nr=r;
        while(true){
          nf+=df; nr+=dr;
          if(!inside(nf,nr)) break;
          let nidx=FRToIdx(nf,nr);
          if(board[nidx]===".") moves.push({from:idx,to:nidx});
          else{
            if((board[nidx]===board[nidx].toUpperCase())!==isWhite) moves.push({from:idx,to:nidx});
            break;
          }
        }
      }
      break;
    case "q":
      for(let [df,dr] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        let nf=f,nr=r;
        while(true){
          nf+=df; nr+=dr;
          if(!inside(nf,nr)) break;
          let nidx=FRToIdx(nf,nr);
          if(board[nidx]===".") moves.push({from:idx,to:nidx});
          else{
            if((board[nidx]===board[nidx].toUpperCase())!==isWhite) moves.push({from:idx,to:nidx});
            break;
          }
        }
      }
      break;
    case "k":
      for(let [df,dr] of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
        let nf=f+df,nr=r+dr;
        if(!inside(nf,nr)) continue;
        let nidx=FRToIdx(nf,nr);
        if(board[nidx]==="."||((board[nidx]===board[nidx].toUpperCase())!==isWhite)){
          moves.push({from:idx,to:nidx});
        }
      }
      // castling
      if(isWhite && r===0 && f===4){
        if(canCastleWK && board[FRToIdx(5,0)]==="." && board[FRToIdx(6,0)]===".")
          moves.push({from:idx,to:FRToIdx(6,0),special:"castle"});
        if(canCastleWQ && board[FRToIdx(3,0)]==="." && board[FRToIdx(2,0)]==="." && board[FRToIdx(1,0)]===".")
          moves.push({from:idx,to:FRToIdx(2,0),special:"castle"});
      }
      if(!isWhite && r===7 && f===4){
        if(canCastleBK && board[FRToIdx(5,7)]==="." && board[FRToIdx(6,7)]===".")
          moves.push({from:idx,to:FRToIdx(6,7),special:"castle"});
        if(canCastleBQ && board[FRToIdx(3,7)]==="." && board[FRToIdx(2,7)]==="." && board[FRToIdx(1,7)]===".")
          moves.push({from:idx,to:FRToIdx(2,7),special:"castle"});
      }
      break;
  }
  return moves;
}

/* -----------------------
   Move Making
   ----------------------- */
function makeMove(m,promotion){
  const piece=board[m.from];
  const isWhite=piece===piece.toUpperCase();
  board[m.from]=".";
  let target=piece;

  if(m.special==="ep"){
    const {f,r}=idxToFR(m.to);
    board[FRToIdx(f,r+(isWhite?-1:1))]=".";
  }
  if(m.special==="castle"){
    if(m.to===FRToIdx(6,0)){ board[FRToIdx(5,0)]="R"; board[FRToIdx(7,0)]="."; }
    if(m.to===FRToIdx(2,0)){ board[FRToIdx(3,0)]="R"; board[FRToIdx(0,0)]="."; }
    if(m.to===FRToIdx(6,7)){ board[FRToIdx(5,7)]="r"; board[FRToIdx(7,7)]="."; }
    if(m.to===FRToIdx(2,7)){ board[FRToIdx(3,7)]="r"; board[FRToIdx(0,7)]="."; }
  }
  if(piece.toLowerCase()==="p"){
    const {r}=idxToFR(m.to);
    if(r===7||r===0){
      target=isWhite?promotion.toUpperCase():promotion.toLowerCase();
    }
  }
  board[m.to]=target;

  if(piece==="K"){canCastleWK=false; canCastleWQ=false;}
  if(piece==="R" && m.from===FRToIdx(0,0)) canCastleWQ=false;
  if(piece==="R" && m.from===FRToIdx(7,0)) canCastleWK=false;
  if(piece==="k"){canCastleBK=false; canCastleBQ=false;}
  if(piece==="r" && m.from===FRToIdx(0,7)) canCastleBQ=false;
  if(piece==="r" && m.from===FRToIdx(7,7)) canCastleBK=false;

  enPassant=null;
  if(m.special==="double"){
    const {f,r}=idxToFR(m.to);
    enPassant=FRToIdx(f,r+(isWhite?-1:1));
  }

  sideToMove=isWhite?"b":"w";
  moveHistory.push(m);
  lastFrom=m.from; lastTo=m.to;
}

/* -----------------------
   Drag & Drop
   ----------------------- */
let selected=null;

function addDragHandlers(){
  document.querySelectorAll(".piece").forEach(pe=>{
    pe.addEventListener("dragstart",ev=>{
      selected=Number(pe.dataset.idx);
      ev.dataTransfer.setData("text/plain",selected);
      setTimeout(()=>pe.classList.add("dragging"),0);
    });
    pe.addEventListener("dragend",ev=>{
      pe.classList.remove("dragging");
      clearHighlights();
      selected=null;
    });
    pe.addEventListener("click",()=>{
      if(selected===null){
        selected=Number(pe.dataset.idx);
        highlightMoves(selected);
      } else {
        if(Number(pe.dataset.idx)===selected){ clearHighlights(); selected=null; }
      }
    });
  });
  document.querySelectorAll(".square").forEach(sq=>{
    sq.addEventListener("dragover",ev=>ev.preventDefault());
    sq.addEventListener("drop",ev=>{
      ev.preventDefault();
      if(selected!==null){
        const target=Number(sq.dataset.idx);
        attemptMove(selected,target);
      }
    });
    sq.addEventListener("click",()=>{
      if(selected!==null){
        attemptMove(selected,Number(sq.dataset.idx));
      }
    });
  });
}

function attemptMove(from,to){
  const moves=generateMoves(from);
  for(let m of moves){
    if(m.to===to){
      if(board[from].toLowerCase()==="p"){
        const {r}=idxToFR(to);
        if(r===7||r===0){
          showPromotionDialog(m);
          return;
        }
      }
      makeMove(m,"q");
      drawBoard();
      updateStatus((sideToMove==="w"?"White":"Black")+" to move.");
      return;
    }
  }
  clearHighlights();
  selected=null;
}

function highlightMoves(idx){
  clearHighlights();
  const moves=generateMoves(idx);
  moves.forEach(m=>{
    const sq=document.querySelector(`.square[data-idx='${m.to}']`);
    if(board[m.to]==="."){
      const dot=document.createElement("div");
      dot.className="hint";
      sq.appendChild(dot);
    } else {
      const ring=document.createElement("div");
      ring.className="capture-hint";
      sq.appendChild(ring);
    }
  });
  document.querySelector(`.square[data-idx='${idx}']`).classList.add("selected");
}
function clearHighlights(){
  document.querySelectorAll(".hint,.capture-hint").forEach(e=>e.remove());
  document.querySelectorAll(".square.selected").forEach(e=>e.classList.remove("selected"));
}

/* -----------------------
   Promotion
   ----------------------- */
function showPromotionDialog(move){
  const back=document.getElementById("promoBackdrop");
  const box=document.getElementById("promoChoices");
  box.innerHTML="";
  const isWhite=board[move.from]===board[move.from].toUpperCase();
  for(let p of["q","r","b","n"]){
    const btn=document.createElement("button");
    btn.className="promoBtn";
    btn.textContent=UNICODE[isWhite?p.toUpperCase():p];
    btn.onclick=()=>{
      makeMove(move,p);
      back.style.display="none";
      drawBoard();
      updateStatus((sideToMove==="w"?"White":"Black")+" to move.");
    };
    box.appendChild(btn);
  }
  back.style.display="flex";
}

/* -----------------------
   End Game
   ----------------------- */
function endGame(msg){
  clearInterval(timerInterval);
  updateStatus("Game over. "+msg);
}

/* -----------------------
   Controls
   ----------------------- */
document.getElementById("startBtn").onclick=()=>{
  const mode=document.getElementById("gameMode").value;
  startGame(mode);
};
document.getElementById("resetBtn").onclick=resetGame;
