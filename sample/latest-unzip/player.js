(() => {
  const stage = document.getElementById("stage");
  const quizBox = document.getElementById("quiz-box");
  const feedback = document.getElementById("feedback");
  const audio = document.getElementById("audio");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const progressLabel = document.getElementById("progress-label");
  const scoreLabel = document.getElementById("score-label");
  const titleEl = document.getElementById("course-title");

  let course = null;
  let index = 0;
  let score = 0;
  let maxScore = 0;
  let attempts = {};
  let answered = {};

  function visibleSlides() {
    return course.slides || [];
  }

  function updateChrome() {
    const slides = visibleSlides();
    progressLabel.textContent = (slides.length ? index + 1 : 0) + " / " + slides.length;
    scoreLabel.textContent = "Điểm: " + score + (maxScore ? " / " + maxScore : "");
    btnPrev.disabled = index <= 0;
    const slide = slides[index];
    const gated = slide && slide.type === "quiz" && slide.gating && !answered[slide.id];
    btnNext.disabled = index >= slides.length - 1 || gated;
  }

  function reportProgress() {
    if (!window.ScormBridge) return;
    const slides = visibleSlides();
    const ratio = slides.length ? (index + 1) / slides.length : 0;
    ScormBridge.setSuspendData(JSON.stringify({ index, score, answered }));
    if (ratio >= 1) {
      const pass = !maxScore || (score / maxScore) * 100 >= (course.passScore || 70);
      ScormBridge.setScore(score, 0, maxScore || 100);
      ScormBridge.setStatus(pass ? "passed" : "failed");
    } else {
      ScormBridge.setStatus("incomplete");
      if (maxScore) ScormBridge.setScore(score, 0, maxScore);
    }
  }

  function showContentSlide(slide) {
    const fallback =
      '<div class="content-fallback"><h2>' +
      escapeHtml(slide.title) +
      "</h2><p>" +
      escapeHtml(slide.bodyText || slide.narrationScript || "") +
      "</p></div>";

    if (slide.thumbnail) {
      const img = document.createElement("img");
      img.src = slide.thumbnail;
      img.alt = slide.title || "";
      img.onerror = function () {
        stage.innerHTML = fallback;
      };
      stage.innerHTML = "";
      stage.appendChild(img);
    } else {
      stage.innerHTML = fallback;
    }

    if (slide.audio) {
      audio.src = slide.audio;
      audio.play().catch(function () {});
    }
  }

  function render() {
    const slides = visibleSlides();
    const slide = slides[index];
    feedback.textContent = "";
    feedback.className = "feedback";
    quizBox.classList.add("hidden");
    quizBox.innerHTML = "";
    audio.removeAttribute("src");
    audio.load();
    if (!slide) {
      stage.innerHTML = "<div class='content-fallback'><p>Không có nội dung.</p></div>";
      updateChrome();
      return;
    }

    if (slide.type === "content") {
      showContentSlide(slide);
    } else {
      stage.innerHTML =
        '<div class="content-fallback"><h2>Câu hỏi</h2><p>' +
        escapeHtml(slide.question) +
        "</p></div>";
      quizBox.classList.remove("hidden");
      const opts = (slide.options || [])
        .map(function (o) {
          const inputType =
            slide.quizType === "single" || slide.quizType === "truefalse"
              ? "radio"
              : "checkbox";
          return (
            '<label><input type="' +
            inputType +
            '" name="q" value="' +
            o.id +
            '"/> ' +
            escapeHtml(o.text) +
            "</label>"
          );
        })
        .join("");
      quizBox.innerHTML =
        opts + '<button id="btn-submit" type="button">Gửi đáp án</button>';
      document.getElementById("btn-submit").onclick = function () {
        submitQuiz(slide);
      };
    }
    updateChrome();
    reportProgress();
  }

  function submitQuiz(slide) {
    attempts[slide.id] = (attempts[slide.id] || 0) + 1;
    const selected = [...quizBox.querySelectorAll('input[name="q"]:checked')].map((i) => i.value);
    const correctIds = slide.options.filter((o) => o.correct).map((o) => o.id).sort().join(",");
    const chosen = selected.slice().sort().join(",");
    const ok = correctIds === chosen && selected.length > 0;
    if (ok) {
      if (!answered[slide.id]) {
        score += slide.points || 1;
        answered[slide.id] = true;
      }
      feedback.textContent = slide.feedbackCorrect || "Chính xác!";
      feedback.className = "feedback";
      updateChrome();
      reportProgress();
      return;
    }
    feedback.textContent = slide.feedbackIncorrect || "Chưa đúng, hãy thử lại.";
    feedback.className = "feedback bad";
    const maxA = slide.maxAttempts || 0;
    if (maxA > 0 && attempts[slide.id] >= maxA) {
      answered[slide.id] = true;
      updateChrome();
    }
    reportProgress();
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  btnPrev.onclick = () => {
    if (index > 0) { index -= 1; render(); }
  };
  btnNext.onclick = () => {
    const slides = visibleSlides();
    if (index < slides.length - 1) { index += 1; render(); }
  };

  window.addEventListener("beforeunload", () => {
    if (window.ScormBridge) ScormBridge.finish();
  });

  function bootCourse(data) {
    course = data;
    titleEl.textContent = data.title || "Bài giảng";
    maxScore = (data.slides || [])
      .filter(function (s) {
        return s.type === "quiz";
      })
      .reduce(function (sum, s) {
        return sum + (s.points || 1);
      }, 0);
    if (window.ScormBridge) {
      ScormBridge.connect();
      try {
        const raw = ScormBridge.getSuspendData();
        if (raw) {
          const saved = JSON.parse(raw);
          if (typeof saved.index === "number") index = saved.index;
          if (typeof saved.score === "number") score = saved.score;
          if (saved.answered) answered = saved.answered;
        }
      } catch (e) {}
      ScormBridge.setStatus("incomplete");
    }
    render();
  }

  function loadCourse() {
    const embedded = document.getElementById("course-data");
    if (embedded && embedded.textContent && embedded.textContent.trim()) {
      try {
        bootCourse(JSON.parse(embedded.textContent));
        return;
      } catch (e) {}
    }
    fetch("course.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(bootCourse)
      .catch(function () {
        titleEl.textContent = "Không tải được course.json";
        stage.innerHTML =
          "<div class='content-fallback'><p>Không tải được dữ liệu bài giảng.</p></div>";
      });
  }

  loadCourse();
})();
