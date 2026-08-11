/* Minimal SCORM 1.2 / 2004 wrapper */
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
