/* Minimal SCORM 1.2 / 2004 wrapper */
(function (global) {
  var API = null;
  var version = null;

  function findAPI(win) {
    var attempts = 0;
    while (win && attempts < 500) {
      if (win.API_1484_11) return { api: win.API_1484_11, version: "2004" };
      if (win.API) return { api: win.API, version: "1.2" };
      if (win.parent && win.parent === win) break;
      win = win.parent;
      attempts++;
    }
    return null;
  }

  function init() {
    var found = findAPI(window);
    if (!found && window.opener) found = findAPI(window.opener);
    if (!found) return false;
    API = found.api;
    version = found.version;
    if (version === "2004") {
      API.Initialize("");
    } else {
      API.LMSInitialize("");
    }
    return true;
  }

  function get(el) {
    if (!API) return "";
    return version === "2004" ? API.GetValue(el) : API.LMSGetValue(el);
  }

  function set(el, val) {
    if (!API) return "false";
    return version === "2004" ? API.SetValue(el, val) : API.LMSSetValue(el, val);
  }

  function commit() {
    if (!API) return "false";
    return version === "2004" ? API.Commit("") : API.LMSCommit("");
  }

  function finish() {
    if (!API) return "false";
    return version === "2004" ? API.Terminate("") : API.LMSFinish("");
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
