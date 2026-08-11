(function () {
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

  function visibleSlides() {
    return (course && course.slides) || [];
  }

  function updateChrome() {
    var slides = visibleSlides();
    progressLabel.textContent = (slides.length ? index + 1 : 0) + " / " + slides.length;
    scoreLabel.textContent = "Điểm: " + score + (maxScore ? " / " + maxScore : "");
    btnPrev.disabled = index <= 0;
    var slide = slides[index];
    var gated = !!(slide && slide.type === "quiz" && slide.gating && !answered[slide.id]);
    btnNext.disabled = index >= slides.length - 1 || gated;
  }

  function reportProgress() {
    if (!window.ScormBridge) return;
    var slides = visibleSlides();
    var ratio = slides.length ? (index + 1) / slides.length : 0;
    ScormBridge.setSuspendData(JSON.stringify({ index: index, score: score, answered: answered }));
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

  function showContentSlide(slide) {
    var fallback =
      '<div class="content-fallback"><h2>' +
      escapeHtml(slide.title) +
      "</h2><p>" +
      escapeHtml(slide.bodyText || slide.narrationScript || "") +
      "</p></div>";

    if (slide.thumbnail) {
      var img = document.createElement("img");
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
      try { audio.play(); } catch (e) {}
    }
  }

  function submitQuiz(slide) {
    attempts[slide.id] = (attempts[slide.id] || 0) + 1;
    var selected = [];
    var inputs = quizBox.querySelectorAll('input[name="q"]:checked');
    for (var i = 0; i < inputs.length; i++) selected.push(inputs[i].value);
    var correctIds = slide.options
      .filter(function (o) { return o.correct; })
      .map(function (o) { return o.id; })
      .sort()
      .join(",");
    var chosen = selected.slice().sort().join(",");
    var ok = correctIds === chosen && selected.length > 0;
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
    var maxA = slide.maxAttempts || 0;
    if (maxA > 0 && attempts[slide.id] >= maxA) {
      answered[slide.id] = true;
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
    audio.removeAttribute("src");
    try { audio.load(); } catch (e) {}
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
      var opts = (slide.options || [])
        .map(function (o) {
          var inputType =
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
        '<p style="margin:0 0 .5rem;font-weight:700;">Chọn đáp án</p>' +
        opts +
        '<button id="btn-submit" type="button">Gửi đáp án</button>';
      var submitBtn = document.getElementById("btn-submit");
      if (submitBtn) {
        submitBtn.onclick = function () {
          submitQuiz(slide);
        };
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
    titleEl.textContent = data.title || "Bài giảng";
    maxScore = (data.slides || [])
      .filter(function (s) { return s.type === "quiz"; })
      .reduce(function (sum, s) { return sum + (s.points || 1); }, 0);
    if (window.ScormBridge) {
      try {
        ScormBridge.connect();
        var raw = ScormBridge.getSuspendData();
        if (raw) {
          var saved = JSON.parse(raw);
          if (typeof saved.index === "number") index = saved.index;
          if (typeof saved.score === "number") score = saved.score;
          if (saved.answered) answered = saved.answered;
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
    var embedded = document.getElementById("course-data");
    if (embedded) {
      var raw = (embedded.textContent || embedded.innerText || "").trim();
      if (raw) {
        try {
          bootCourse(JSON.parse(raw));
          return;
        } catch (e) {
          showLoadError("Dữ liệu nhúng không hợp lệ: " + (e && e.message ? e.message : e));
          return;
        }
      }
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
            "Không tải được course.json. Hãy giải nén đủ thư mục SCORM rồi mở index.html. (" +
              (err && err.message ? err.message : err) +
              ")"
          );
        });
      return;
    }
    showLoadError("Trình duyệt không hỗ trợ tải course.json.");
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
