"use strict";

const videoCount = 5;
const staticCount = 45;
const byId = id => document.getElementById(id);
const exam = byId("exam");
const results = byId("results");
const dialog = byId("confirm");
const selectedVideos = new Map();
let paper = [];
let answers = [];
let navigation = [];
let current = 0;
let furthestVideo = 0;

function sample(bank, count) {
  const pool = bank.slice();
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content) node.textContent = content;
  if (className) node.className = className;
  return node;
}

function figures(q) {
  const group = element("div", "", "figures");
  q.images?.forEach((src, index) => {
    const figure = element("figure");
    const image = element("img");
    image.src = src;
    image.alt = q.imageLabels?.[index] ?? "題目圖示";
    figure.append(image);
    if (q.imageLabels) figure.append(element("figcaption", q.imageLabels[index]));
    group.append(figure);
  });
  return group;
}

function videoPlayer(q) {
  const container = element("div");
  const slot = element("div");
  const note = element("p", "", "media-note");
  const link = element("a", "另開公路局影片 " + q.code);
  link.href = q.share;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const picker = element("input");
  picker.type = "file";
  picker.accept = "video/*,.mp4";
  const local = element("details");
  const label = element("label", "選擇影片 " + q.code + " ");
  label.append(picker);
  local.append(element("summary", "使用已下載的影片"), label);
  note.append("若內嵌影片無法播放，可", link, "。");

  function showShare() {
    const frame = element("iframe");
    frame.src = q.share;
    frame.title = "公路局危險感知影片 " + q.code;
    frame.allow = "fullscreen";
    frame.allowFullscreen = true;
    slot.replaceChildren(frame);
  }

  function showVideo(source, fallback) {
    const player = element("video");
    player.controls = true;
    player.playsInline = true;
    player.preload = "metadata";
    player.setAttribute("aria-label", "危險感知影片 " + q.code);
    player.addEventListener("error", fallback, { once: true });
    player.src = source;
    slot.replaceChildren(player);
  }

  function showLocal(source) {
    showVideo(source, () => {
      if (slot.querySelector("video")?.src !== source) return;
      note.prepend("這個影片檔無法播放。");
      showShare();
    });
  }

  picker.addEventListener("change", () => {
    const file = picker.files[0];
    if (!file) return;
    const oldSource = selectedVideos.get(q.code);
    const source = URL.createObjectURL(file);
    selectedVideos.set(q.code, source);
    showLocal(source);
    if (oldSource) URL.revokeObjectURL(oldSource);
  });

  if (selectedVideos.has(q.code)) {
    showLocal(selectedVideos.get(q.code));
  } else if (q.video) {
    showVideo(q.video, showShare);
  } else {
    showShare();
  }
  container.append(slot, note, local);
  return container;
}

function optionContent(q, index) {
  const content = element("span", q.options[index]);
  if (q.optionImages?.[index]) {
    const img = element("img");
    img.src = q.optionImages[index];
    img.alt = "選項 " + (index + 1) + " 圖示";
    content.append(img);
  }
  return content;
}

function refreshProgress() {
  const answered = answers.filter(value => value !== null).length;
  byId("count").textContent = "已作答 " + answered + " / " + paper.length;
  byId("progress").value = answered;
  navigation.forEach((button, index) => {
    button.classList.toggle("answered", answers[index] !== null);
    button.disabled = furthestVideo < videoCount && index > furthestVideo;
    button.setAttribute("aria-label", "第 " + (index + 1) + " 題，" + (answers[index] === null ? "未作答" : "已作答"));
    if (index === current) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

function renderQuestion(moveFocus = true) {
  const q = paper[current];
  const isVideo = current < videoCount;
  byId("phase").textContent = isVideo ? "危險感知影片題" : "靜態選擇題";
  byId("position").textContent = "第 " + (current + 1) + " 題／共 " + paper.length + " 題";
  byId("prompt").textContent = q.prompt;
  const continuation = byId("continuation");
  continuation.textContent = q.continuation ?? "";
  continuation.hidden = !q.continuation;
  byId("media").replaceChildren(...(isVideo ? [videoPlayer(q)] : q.images ? [figures(q)] : []));
  byId("choices").replaceChildren(...q.options.map((_, index) => {
    const label = element("label", "", "option");
    const input = element("input");
    input.type = "radio";
    input.name = "choice";
    input.checked = answers[current] === index;
    input.addEventListener("change", () => {
      answers[current] = index;
      refreshProgress();
    });
    label.append(input, element("b", (index + 1) + "."), optionContent(q, index));
    return label;
  }));
  byId("prev").disabled = current === 0;
  byId("next").textContent = current === paper.length - 1 ? "交卷" :
    current === videoCount - 1 ? "進入靜態題 →" : "下一題 →";
  refreshProgress();
  if (moveFocus) {
    byId("prompt").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}

function goTo(index) {
  current = index;
  if (index === furthestVideo + 1 && furthestVideo < videoCount) furthestVideo = index;
  renderQuestion();
}

function start() {
  paper = [...sample(window.videoBank, videoCount), ...sample(window.staticBank, staticCount)];
  answers = paper.map(() => null);
  current = 0;
  furthestVideo = 0;
  navigation = paper.map((_, index) => {
    const button = element("button", String(index + 1));
    button.addEventListener("click", () => goTo(index));
    return button;
  });
  byId("video-nav").replaceChildren(...navigation.slice(0, videoCount));
  byId("static-nav").replaceChildren(...navigation.slice(videoCount));
  byId("welcome").hidden = true;
  results.hidden = true;
  byId("review").replaceChildren();
  exam.hidden = false;
  renderQuestion();
}

function askToSubmit() {
  const missing = answers.filter(value => value === null).length;
  byId("confirm-text").textContent = missing
    ? "還有 " + missing + " 題未作答。交卷後會列入錯題複習。"
    : "50 題均已作答。交卷後即可查看結果。";
  dialog.returnValue = "cancel";
  dialog.showModal();
}

function reviewItem(q, index) {
  const item = element("article", "", "card review-item");
  const type = q.code ? "影片題 " + q.id : "靜態題庫第 " + q.id + " 題";
  item.append(element("p", "第 " + (index + 1) + " 題 · " + type, "meta"), element("h3", q.prompt));
  if (q.images) item.append(figures(q));
  if (q.code) {
    const detail = element("details");
    detail.append(element("summary", "重看影片 " + q.code));
    let player;
    detail.addEventListener("toggle", () => {
      if (detail.open) {
        player = videoPlayer(q);
        detail.append(player);
      } else {
        player?.remove();
      }
    });
    item.append(detail);
  }
  if (answers[index] === null) item.append(element("p", "你的答案 · 未作答"));
  q.options.forEach((_, optionIndex) => {
    const correct = optionIndex === q.answer;
    const chosen = answers[index] === optionIndex;
    const row = element("div", "", "option" + (correct ? " correct" : chosen ? " wrong" : ""));
    const content = optionContent(q, optionIndex);
    row.append(element("b", (optionIndex + 1) + "."), content);
    if (correct || chosen) content.append(element("strong", correct ? "　✓ 正確答案" : "　你的答案"));
    item.append(row);
  });
  if (q.continuation) item.append(element("p", q.continuation, "question-continuation"));
  return item;
}

function submit() {
  const review = paper.flatMap((q, index) => answers[index] !== q.answer ? [reviewItem(q, index)] : []);
  const correct = paper.length - review.length;
  const missing = answers.filter(value => value === null).length;
  byId("score").textContent = correct * 2 + " 分";
  byId("summary").textContent = "答對 " + correct + " 題 · 答錯 " + (review.length - missing) + " 題 · 未作答 " + missing + " 題";
  byId("review").replaceChildren(...(review.length ? review : [element("p", "全數答對。", "card")]));
  byId("media").replaceChildren();
  exam.hidden = true;
  results.hidden = false;
  byId("result-title").focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

byId("start").addEventListener("click", start);
byId("again").addEventListener("click", start);
byId("prev").addEventListener("click", () => goTo(current - 1));
byId("next").addEventListener("click", () => current === paper.length - 1 ? askToSubmit() : goTo(current + 1));
byId("jump").addEventListener("click", () => {
  const navigator = byId("navigator");
  navigator.focus({ preventScroll: true });
  navigator.scrollIntoView({ block: "start" });
});
byId("finish").addEventListener("click", askToSubmit);
dialog.addEventListener("close", () => {
  if (dialog.returnValue === "submit") submit();
});
