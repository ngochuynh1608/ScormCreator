export const PLAYER_CSS = `:root {
  --bg: #0b1520;
  --ink: #edf3f7;
  --bar: #121f2c;
  --accent: #3ddc97;
  --btn-secondary: #2a3a4a;
  --muted: #8aa0b2;
  --card: #0f1c28;
  --danger: #ffb4a2;
  --quiz-bg: rgba(10, 18, 28, 0.94);
  --quiz-ink: #edf3f7;
  --quiz-option: rgba(255,255,255,.06);
  --quiz-border: rgba(255,255,255,.08);
}
html[data-quiz-theme="light"] {
  --quiz-bg: rgba(248, 250, 252, 0.97);
  --quiz-ink: #0f2a36;
  --quiz-option: rgba(15, 42, 54, 0.06);
  --quiz-border: rgba(15, 42, 54, 0.12);
  --danger: #c45c26;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  font-family: "Segoe UI", "Be Vietnam Pro", system-ui, sans-serif;
  color: var(--ink);
  background: var(--bg);
}
#app {
  min-height: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.player-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 12px 12px 0;
}
.stage-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #000;
  border-radius: 16px 16px 0 0;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  max-height: calc(100vh - 108px);
}
.stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}
.stage img,
.stage video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #000;
}
.stage .content-fallback {
  padding: 2rem;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: var(--card);
}
.stage h2 { margin-top: 0; }
.stage p { white-space: pre-wrap; line-height: 1.5; color: #c9d8e3; }
.quiz-overlay {
  position: absolute;
  inset: auto 0 0 0;
  max-height: 55%;
  overflow: auto;
  padding: 14px 16px;
  color: var(--quiz-ink);
  background: var(--quiz-bg);
  border-top: 1px solid var(--quiz-border);
}
.quiz-overlay.hidden { display: none; }
.quiz-overlay label {
  display: block;
  background: var(--quiz-option);
  margin: .4rem 0;
  padding: .7rem .8rem;
  border-radius: 10px;
  cursor: pointer;
  color: var(--quiz-ink);
}
.feedback { min-height: 1.2em; margin: .4rem 0 .2rem; color: #b7f5d6; }
html[data-quiz-theme="light"] .feedback { color: #1a5c40; }
.feedback.bad { color: var(--danger); }
.controls {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bar);
  border-radius: 0 0 16px 16px;
  margin-bottom: 12px;
}
.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.controls-center {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
#course-title {
  margin: 0;
  font-size: 13px;
  color: #d7e6ef;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
audio {
  width: 100%;
  height: 36px;
}
button {
  border: 0;
  border-radius: 999px;
  padding: .65rem 1rem;
  font-weight: 700;
  cursor: pointer;
  background: var(--accent);
  color: #083024;
}
button:disabled { opacity: .45; cursor: not-allowed; }
#btn-prev {
  background: var(--btn-secondary);
  color: #fff;
}
#btn-next {
  background: var(--accent);
  color: #083024;
}
.error-box {
  color: #b42318;
  background: #fee4e2;
  padding: .75rem 1rem;
  border-radius: 12px;
  margin: 1rem;
}
@media (max-width: 720px) {
  .controls {
    grid-template-columns: 1fr;
  }
  .controls-left,
  .controls-right {
    justify-content: space-between;
  }
  .stage-wrap {
    aspect-ratio: auto;
    min-height: 220px;
    max-height: none;
    flex: 1;
  }
}
`;

export const SCORM_API_JS = `/* Minimal SCORM 1.2 / 2004 wrapper */
(function (global) {
  var API = null;
  var version = null;

  function findAPI(win) {
    var attempts = 0;
    while (win && attempts < 500) {
      try {
        if (win.API_1484_11) return { api: win.API_1484_11, version: "2004" };
        if (win.API) return { api: win.API, version: "1.2" };
      } catch (e) {}
      if (win.parent && win.parent === win) break;
      try { win = win.parent; } catch (e) { break; }
      attempts++;
    }
    return null;
  }

  function init() {
    var found = null;
    try { found = findAPI(window); } catch (e) {}
    if (!found) {
      try { if (window.opener) found = findAPI(window.opener); } catch (e) {}
    }
    if (!found) return false;
    API = found.api;
    version = found.version;
    try {
      if (version === "2004") API.Initialize("");
      else API.LMSInitialize("");
    } catch (e) {
      return false;
    }
    return true;
  }

  function get(el) {
    if (!API) return "";
    try {
      return version === "2004" ? API.GetValue(el) : API.LMSGetValue(el);
    } catch (e) { return ""; }
  }

  function set(el, val) {
    if (!API) return "false";
    try {
      return version === "2004" ? API.SetValue(el, val) : API.LMSSetValue(el, val);
    } catch (e) { return "false"; }
  }

  function commit() {
    if (!API) return "false";
    try {
      return version === "2004" ? API.Commit("") : API.LMSCommit("");
    } catch (e) { return "false"; }
  }

  function finish() {
    if (!API) return "false";
    try {
      return version === "2004" ? API.Terminate("") : API.LMSFinish("");
    } catch (e) { return "false"; }
  }

  function mapStatus(status) {
    if (version === "2004") {
      if (status === "completed") return { completion: "completed", success: "passed" };
      if (status === "incomplete") return { completion: "incomplete", success: "unknown" };
      if (status === "failed") return { completion: "completed", success: "failed" };
      if (status === "passed") return { completion: "completed", success: "passed" };
    }
    return { lesson: status };
  }

  global.ScormBridge = {
    connected: false,
    version: null,
    connect: function () {
      this.connected = init();
      this.version = version;
      return this.connected;
    },
    getSuspendData: function () {
      return version === "2004" ? get("cmi.suspend_data") : get("cmi.core.lesson_location");
    },
    setSuspendData: function (data) {
      if (version === "2004") set("cmi.suspend_data", data);
      else set("cmi.core.lesson_location", data);
      commit();
    },
    setScore: function (raw, min, max) {
      if (version === "2004") {
        set("cmi.score.raw", String(raw));
        set("cmi.score.min", String(min));
        set("cmi.score.max", String(max));
        set("cmi.score.scaled", String(max ? raw / max : 0));
      } else {
        set("cmi.core.score.raw", String(raw));
        set("cmi.core.score.min", String(min));
        set("cmi.core.score.max", String(max));
      }
      commit();
    },
    setStatus: function (status) {
      var mapped = mapStatus(status);
      if (version === "2004") {
        if (mapped.completion) set("cmi.completion_status", mapped.completion);
        if (mapped.success) set("cmi.success_status", mapped.success);
      } else {
        set("cmi.core.lesson_status", mapped.lesson || status);
      }
      commit();
    },
    finish: function () { finish(); }
  };
})(window);
`;

export const PLAYER_JS = `(function () {
  var stage = document.getElementById("stage");
  var quizBox = document.getElementById("quiz-box");
  var feedback = document.getElementById("feedback");
  var audio = document.getElementById("audio");
  var btnPrev = document.getElementById("btn-prev");
  var btnNext = document.getElementById("btn-next");
  var progressLabel = document.getElementById("progress-label");
  var scoreLabel = document.getElementById("score-label");
  var titleEl = document.getElementById("course-title");

  if (!stage || !titleEl) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div class="error-box">Lỗi player: thiếu phần tử HTML bắt buộc.</div>'
    );
    return;
  }

  var course = null;
  var index = 0;
  var score = 0;
  var maxScore = 0;
  var attempts = {};
  var answered = {};
  var audioDone = true;
  var audioRequireBound = false;
  var audioGateToken = 0;

  function requireFullAudio() {
    return !!(course && course.requireFullAudio);
  }

  function applyPlayerTheme() {
    if (!course) return;
    var root = document.documentElement;
    if (course.buttonPrimary) {
      root.style.setProperty("--accent", course.buttonPrimary);
    }
    if (course.buttonSecondary) {
      root.style.setProperty("--btn-secondary", course.buttonSecondary);
    }
    root.setAttribute(
      "data-quiz-theme",
      course.quizTheme === "light" ? "light" : "dark",
    );
  }

  function unbindAudioGate() {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audioRequireBound = false;
  }

  function markAudioDone(token) {
    if (token !== audioGateToken) return;
    audioDone = true;
    updateChrome();
  }

  function bindAudioGate(hasAudio) {
    audioGateToken += 1;
    var token = audioGateToken;
    unbindAudioGate();
    if (!hasAudio || !requireFullAudio()) {
      audioDone = true;
      return;
    }
    audioDone = false;
    audioRequireBound = true;
    audio.onended = function () {
      markAudioDone(token);
    };
    audio.onerror = function () {
      // Ignore errors from clearing/empty src; only unlock when a real src failed.
      if (!audio.getAttribute("src")) return;
      markAudioDone(token);
    };
  }

  function canAdvanceFromCurrent() {
    var slides = visibleSlides();
    var slide = slides[index];
    if (!slide) return false;
    if (index >= slides.length - 1) return false;
    if (
      slide.type === "quiz" &&
      slide.gating &&
      !isQuizSlideDone(slide)
    ) {
      return false;
    }
    if (
      slide.type === "content" &&
      requireFullAudio() &&
      slide.audio &&
      !audioDone
    ) {
      return false;
    }
    return true;
  }

  function visibleSlides() {
    return (course && course.slides) || [];
  }

  function quizQuestions(slide) {
    if (slide.questions && slide.questions.length) return slide.questions;
    if (slide.question) {
      return [
        {
          id: slide.id + "-legacy",
          quizType: slide.quizType || "single",
          question: slide.question,
          options: slide.options || [],
          feedbackCorrect: slide.feedbackCorrect || "Chính xác!",
          feedbackIncorrect: slide.feedbackIncorrect || "Chưa đúng.",
          points: slide.points || 1,
          maxAttempts: slide.maxAttempts || 2,
        },
      ];
    }
    return [];
  }

  function questionKey(slideId, questionId) {
    return slideId + "::" + questionId;
  }

  function isQuizSlideDone(slide) {
    var qs = quizQuestions(slide);
    if (!qs.length) return true;
    for (var i = 0; i < qs.length; i++) {
      if (!answered[questionKey(slide.id, qs[i].id)]) return false;
    }
    return true;
  }

  function updateChrome() {
    var slides = visibleSlides();
    progressLabel.textContent = (slides.length ? index + 1 : 0) + " / " + slides.length;
    scoreLabel.textContent = "Điểm: " + score + (maxScore ? " / " + maxScore : "");
    btnPrev.disabled = index <= 0;
    var slide = slides[index];
    var quizGated = !!(
      slide &&
      slide.type === "quiz" &&
      slide.gating &&
      !isQuizSlideDone(slide)
    );
    var audioGated = !!(
      slide &&
      slide.type === "content" &&
      requireFullAudio() &&
      slide.audio &&
      !audioDone
    );
    btnNext.disabled =
      index >= slides.length - 1 || quizGated || audioGated;
  }

  function reportProgress() {
    if (!window.ScormBridge) return;
    var slides = visibleSlides();
    var ratio = slides.length ? (index + 1) / slides.length : 0;
    ScormBridge.setSuspendData(JSON.stringify({ index: index, score: score, answered: answered, attempts: attempts }));
    if (ratio >= 1) {
      var pass = !maxScore || (score / maxScore) * 100 >= (course.passScore || 70);
      ScormBridge.setScore(score, 0, maxScore || 100);
      ScormBridge.setStatus(pass ? "passed" : "failed");
    } else {
      ScormBridge.setStatus("incomplete");
      if (maxScore) ScormBridge.setScore(score, 0, maxScore);
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resolveAsset(rel) {
    if (!rel) return "";
    if (/^(data:|https?:|blob:)/i.test(rel)) return rel;
    try {
      return new URL(rel.replace(/^[/]+/, ""), window.location.href).href;
    } catch (e) {
      return rel;
    }
  }

  function showContentSlide(slide) {
    var fallback =
      '<div class="content-fallback"><h2>' +
      escapeHtml(slide.title) +
      "</h2><p>" +
      escapeHtml(slide.bodyText || slide.narrationScript || "") +
      "</p></div>";

    stage.innerHTML = "";
    var wrap = document.createElement("div");
    wrap.className = "design-stage";
    wrap.style.cssText =
      "position:relative;width:100%;height:100%;overflow:hidden;background:#0f2a36;";

    if (slide.video) {
      var video = document.createElement("video");
      video.src = resolveAsset(slide.video);
      video.controls = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.style.cssText = "width:100%;height:100%;object-fit:contain;";
      if (slide.thumbnail) video.poster = resolveAsset(slide.thumbnail);
      video.onerror = function () {
        stage.innerHTML =
          fallback +
          '<p style="color:#ffb4a2;margin-top:1rem">Không tải được video slide.</p>';
      };
      wrap.appendChild(video);
    } else if (slide.thumbnail) {
      var bgBox = document.createElement("div");
      bgBox.style.cssText =
        "position:absolute;inset:0;overflow:hidden;";
      var img = document.createElement("img");
      img.src = resolveAsset(slide.thumbnail);
      img.alt = slide.title || "";
      var crop = slide.imageCrop;
      if (crop && crop.w > 0 && crop.h > 0) {
        img.style.cssText =
          "position:absolute;left:" +
          (-crop.x / crop.w) * 100 +
          "%;top:" +
          (-crop.y / crop.h) * 100 +
          "%;width:" +
          (100 / crop.w) * 100 +
          "%;height:" +
          (100 / crop.h) * 100 +
          "%;max-width:none;object-fit:fill;";
      } else {
        img.style.cssText = "width:100%;height:100%;object-fit:contain;";
      }
      img.onerror = function () {
        stage.innerHTML =
          fallback +
          '<p style="color:#ffb4a2;margin-top:1rem">Không tải được ảnh slide.<br/>' +
          "Hãy <b>giải nén toàn bộ ZIP</b> ra một thư mục, rồi mở file <b>index.html</b> trong thư mục đó " +
          "(không mở trực tiếp bên trong file ZIP). Thư mục <b>thumbs/</b> phải nằm cạnh index.html.</p>";
      };
      bgBox.appendChild(img);
      wrap.appendChild(bgBox);
    } else {
      wrap.innerHTML = fallback;
    }

    var layers = (slide.designLayers || []).slice().sort(function (a, b) {
      return (a.z || 0) - (b.z || 0);
    });
    layers.forEach(function (layer) {
      var el = document.createElement("div");
      if (layer.kind === "hotspot") {
        var d = Math.min(layer.w, layer.h);
        el.style.cssText =
          "position:absolute;left:" +
          layer.x +
          "%;top:" +
          layer.y +
          "%;width:" +
          d +
          "%;height:auto;aspect-ratio:1;border-radius:999px;z-index:" +
          ((layer.z || 0) + 5) +
          ";";
      } else {
        el.style.cssText =
          "position:absolute;left:" +
          layer.x +
          "%;top:" +
          layer.y +
          "%;width:" +
          layer.w +
          "%;height:" +
          layer.h +
          "%;z-index:" +
          ((layer.z || 0) + 5) +
          ";";
      }
      if (layer.kind === "image" && layer.src) {
        var limg = document.createElement("img");
        limg.src = resolveAsset(layer.src);
        limg.style.cssText = "width:100%;height:100%;object-fit:contain;";
        el.appendChild(limg);
      } else if (layer.kind === "text") {
        var t = document.createElement("div");
        t.textContent = layer.text || "";
        t.style.cssText =
          "width:100%;height:100%;display:flex;align-items:center;justify-content:" +
          (layer.align === "left"
            ? "flex-start"
            : layer.align === "right"
              ? "flex-end"
              : "center") +
          ";color:" +
          (layer.color || "#fff") +
          ";font-weight:" +
          (layer.bold ? "700" : "500") +
          ";font-size:" +
          Math.max(12, (layer.fontSize || 4) * 4) +
          "px;padding:0 4px;overflow:hidden;text-align:" +
          (layer.align || "center") +
          ";";
        el.appendChild(t);
      } else if (layer.kind === "hotspot") {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = layer.label || "?";
        var hsColor = layer.color || "#2f6fed";
        btn.style.cssText =
          "width:100%;height:100%;border:0;border-radius:999px;background:" +
          hsColor +
          ";color:#fff;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25);outline:2px solid rgba(255,255,255,.7);";
        btn.onclick = function () {
          openHotspotQuiz(layer);
        };
        el.appendChild(btn);
      }
      wrap.appendChild(el);
    });

    stage.appendChild(wrap);

    if (slide.audio) {
      bindAudioGate(true);
      audio.src = resolveAsset(slide.audio);
      try {
        audio.play();
      } catch (e) {}
    } else {
      bindAudioGate(false);
    }
  }

  function openHotspotQuiz(layer) {
    var q = layer.question || {};
    var options = q.options || [];
    var answered = false;
    var html =
      '<div style="position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5);padding:1rem">' +
      '<form id="hs-form" style="width:100%;max-width:28rem;background:#fff;color:#0f2a36;border-radius:1rem;padding:1.25rem">' +
      "<p style='font-weight:600;margin:0 0 .75rem'>" +
      escapeHtml(q.question || "Câu hỏi") +
      "</p>";
    options.forEach(function (o) {
      html +=
        "<label style='display:flex;gap:.5rem;align-items:center;margin:.35rem 0;padding:.5rem .75rem;background:#f3f6f9;border-radius:.75rem;cursor:pointer'>" +
        '<input type="radio" name="hs" value="' +
        escapeHtml(o.id) +
        '" required />' +
        "<span>" +
        escapeHtml(o.text || "") +
        "</span></label>";
    });
    html +=
      '<p id="hs-fb" style="display:none;margin:.5rem 0 0;padding:.6rem .75rem;border-radius:.75rem;font-weight:600;font-size:.9rem"></p>' +
      "<div style='display:flex;justify-content:flex-end;gap:.5rem;margin-top:.75rem'>" +
      '<button type="button" id="hs-close" style="border:0;border-radius:999px;padding:.5rem 1rem;background:#e8eef5;font-weight:600">Đóng</button>' +
      '<button type="submit" id="hs-submit" style="border:0;border-radius:999px;padding:.5rem 1rem;background:#2bb673;font-weight:700">Gửi</button>' +
      "</div></form></div>";
    var host = document.createElement("div");
    host.innerHTML = html;
    document.body.appendChild(host);
    var fbEl = host.querySelector("#hs-fb");
    var submitBtn = host.querySelector("#hs-submit");
    host.querySelector("#hs-close").onclick = function () {
      host.remove();
    };
    host.querySelector("#hs-form").onsubmit = function (ev) {
      ev.preventDefault();
      if (answered) {
        host.remove();
        return;
      }
      var chosen = (host.querySelector('input[name="hs"]:checked') || {}).value;
      var correct = options.find(function (o) {
        return o.correct;
      });
      var ok = !!(chosen && correct && chosen === correct.id);
      if (ok) {
        score += q.points || 1;
        updateChrome();
      }
      answered = true;
      var inputs = host.querySelectorAll('input[name="hs"]');
      for (var i = 0; i < inputs.length; i++) inputs[i].disabled = true;
      if (fbEl) {
        fbEl.style.display = "block";
        fbEl.style.background = ok ? "#e8f8ef" : "#fff4ef";
        fbEl.style.color = ok ? "#1f7a4d" : "#c45c26";
        fbEl.textContent =
          (ok ? "Đúng — " : "Sai — ") +
          (ok
            ? q.feedbackCorrect || "Chính xác!"
            : q.feedbackIncorrect || "Chưa đúng, hãy thử lại.");
      }
      if (submitBtn) submitBtn.textContent = "Xong";
    };
  }

  function submitQuizQuestion(slide, question) {
    var key = questionKey(slide.id, question.id);
    attempts[key] = (attempts[key] || 0) + 1;
    var selected = [];
    var inputs = quizBox.querySelectorAll(
      'input[name="q-' + question.id + '"]:checked',
    );
    for (var i = 0; i < inputs.length; i++) selected.push(inputs[i].value);
    var correctIds = (question.options || [])
      .filter(function (o) {
        return o.correct;
      })
      .map(function (o) {
        return o.id;
      })
      .sort()
      .join(",");
    var chosen = selected.slice().sort().join(",");
    var ok = correctIds === chosen && selected.length > 0;
    var fb = document.getElementById("fb-" + question.id);
    if (ok) {
      if (!answered[key]) {
        score += question.points || 1;
        answered[key] = true;
      }
      if (fb) {
        fb.textContent = question.feedbackCorrect || "Chính xác!";
        fb.className = "feedback";
      }
      updateChrome();
      reportProgress();
      return;
    }
    if (fb) {
      fb.textContent = question.feedbackIncorrect || "Chưa đúng, hãy thử lại.";
      fb.className = "feedback bad";
    }
    var maxA = question.maxAttempts || 0;
    if (maxA > 0 && attempts[key] >= maxA) {
      answered[key] = true;
      updateChrome();
    }
    reportProgress();
  }

  function render() {
    var slides = visibleSlides();
    var slide = slides[index];
    feedback.textContent = "";
    feedback.className = "feedback";
    quizBox.classList.add("hidden");
    quizBox.innerHTML = "";
    unbindAudioGate();
    audioGateToken += 1;
    audio.removeAttribute("src");
    try {
      audio.load();
    } catch (e) {}
    audioDone = true;
    if (!slide) {
      stage.innerHTML =
        "<div class='content-fallback'><p>Không có nội dung.</p></div>";
      updateChrome();
      return;
    }

    if (slide.type === "content") {
      showContentSlide(slide);
    } else {
      bindAudioGate(false);
      var qs = quizQuestions(slide);
      stage.innerHTML =
        '<div class="content-fallback"><h2>' +
        escapeHtml(slide.title || "Câu hỏi") +
        "</h2><p>" +
        escapeHtml(qs.length + " câu hỏi trong slide này") +
        "</p></div>";
      quizBox.classList.remove("hidden");
      quizBox.innerHTML = qs
        .map(function (q, qi) {
          var opts = (q.options || [])
            .map(function (o) {
              return (
                '<label><input type="radio" name="q-' +
                q.id +
                '" value="' +
                o.id +
                '"/> ' +
                escapeHtml(o.text) +
                "</label>"
              );
            })
            .join("");
          return (
            '<div class="quiz-item" data-qid="' +
            q.id +
            '" style="margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,.08)">' +
            '<p style="margin:0 0 .4rem;font-weight:700;">Câu ' +
            (qi + 1) +
            ". " +
            escapeHtml(q.question) +
            "</p>" +
            opts +
            '<button type="button" class="btn-submit-q" data-qid="' +
            q.id +
            '">Gửi đáp án</button>' +
            '<p id="fb-' +
            q.id +
            '" class="feedback" style="margin-top:8px"></p>' +
            "</div>"
          );
        })
        .join("");
      var buttons = quizBox.querySelectorAll(".btn-submit-q");
      for (var b = 0; b < buttons.length; b++) {
        buttons[b].onclick = (function (btn) {
          return function () {
            var qid = btn.getAttribute("data-qid");
            var question = null;
            for (var i = 0; i < qs.length; i++) {
              if (qs[i].id === qid) {
                question = qs[i];
                break;
              }
            }
            if (question) submitQuizQuestion(slide, question);
          };
        })(buttons[b]);
      }
    }
    updateChrome();
    reportProgress();
  }

  function bootCourse(data) {
    if (!data || !data.slides || !data.slides.length) {
      titleEl.textContent = "Bài giảng trống";
      stage.innerHTML =
        "<div class='content-fallback'><p>Không có slide nào trong gói SCORM.</p></div>";
      return;
    }
    course = data;
    applyPlayerTheme();
    titleEl.textContent = data.title || "Bài giảng";
    maxScore = (data.slides || []).reduce(function (sum, s) {
      if (s.type !== "quiz") return sum;
      var qs = quizQuestions(s);
      return (
        sum +
        qs.reduce(function (qSum, q) {
          return qSum + (q.points || 1);
        }, 0)
      );
    }, 0);
    if (window.ScormBridge) {
      try {
        ScormBridge.connect();
        var raw = ScormBridge.getSuspendData();
        if (raw) {
          var saved = JSON.parse(raw);
          if (typeof saved.index === "number") index = saved.index;
          if (typeof saved.score === "number") score = saved.score;
          if (saved.answered) answered = saved.answered;
          if (saved.attempts) attempts = saved.attempts;
        }
        ScormBridge.setStatus("incomplete");
      } catch (e) {}
    }
    render();
  }

  function showLoadError(msg) {
    titleEl.textContent = "Lỗi tải bài giảng";
    stage.innerHTML =
      "<div class='content-fallback'><p>" + escapeHtml(msg) + "</p></div>";
  }

  function loadCourse() {
    if (window.__COURSE__ && typeof window.__COURSE__ === "object") {
      bootCourse(window.__COURSE__);
      return;
    }
    if (typeof fetch === "function") {
      fetch("course.json")
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(bootCourse)
        .catch(function (err) {
          showLoadError(
            "Không tải được dữ liệu. Hãy GIẢI NÉN toàn bộ file ZIP rồi mở index.html trong thư mục đã giải nén (không mở trực tiếp trong ZIP). Chi tiết: " +
              (err && err.message ? err.message : err)
          );
        });
      return;
    }
    showLoadError(
      "Thiếu course-data.js. Hãy giải nén đầy đủ gói SCORM rồi mở lại index.html."
    );
  }

  if (btnPrev) {
    btnPrev.onclick = function () {
      if (index > 0) {
        index -= 1;
        render();
      }
    };
  }
  if (btnNext) {
    btnNext.onclick = function () {
      if (!canAdvanceFromCurrent()) return;
      var slides = visibleSlides();
      if (index < slides.length - 1) {
        index += 1;
        render();
      }
    };
  }

  window.addEventListener("beforeunload", function () {
    if (window.ScormBridge) ScormBridge.finish();
  });

  loadCourse();
})();
`;

export function buildPlayerHtml(courseJson?: string): string {
  // Prefer embedding small course JSON so file:// works without loading external JS.
  // Never embed base64 media here — that makes scripts too large for browsers.
  const courseBlock = courseJson
    ? `<script>window.__COURSE__ = ${courseJson
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/\u2028/g, "\\u2028")
        .replace(/\u2029/g, "\\u2029")};</script>`
    : `<script src="course-data.js"></script>`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bài giảng SCORM</title>
  <style>${PLAYER_CSS}</style>
</head>
<body>
  <div id="app">
    <div class="player-shell">
      <div class="stage-wrap">
        <section id="stage" class="stage"></section>
        <div id="quiz-box" class="quiz-overlay hidden"></div>
      </div>
      <div class="controls">
        <div class="controls-left">
          <button id="btn-prev" type="button">Trước</button>
        </div>
        <div class="controls-center">
          <div class="meta-row">
            <strong id="course-title">Đang tải…</strong>
            <span>
              <span id="progress-label">0 / 0</span>
              ·
              <span id="score-label">Điểm: 0</span>
            </span>
          </div>
          <audio id="audio" controls></audio>
          <p id="feedback" class="feedback"></p>
        </div>
        <div class="controls-right">
          <button id="btn-next" type="button">Tiếp</button>
        </div>
      </div>
    </div>
  </div>
  ${courseBlock}
  <script>${SCORM_API_JS}</script>
  <script>${PLAYER_JS}</script>
</body>
</html>`;
}

/** Kept for LMS resource listing / optional external files */
export const PLAYER_HTML = buildPlayerHtml();
