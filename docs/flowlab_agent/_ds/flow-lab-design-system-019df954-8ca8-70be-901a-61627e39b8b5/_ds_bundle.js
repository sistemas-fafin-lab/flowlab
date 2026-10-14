/* @ds-bundle: {"format":3,"namespace":"FlowLABDesignSystem_019df9","components":[{"name":"AuthScreen","sourcePath":"components/AuthScreen.jsx"},{"name":"Badge","sourcePath":"components/Badge.jsx"},{"name":"Button","sourcePath":"components/Button.jsx"},{"name":"Card","sourcePath":"components/Card.jsx"},{"name":"DashboardScreen","sourcePath":"components/DashboardScreen.jsx"},{"name":"Icon","sourcePath":"components/Icon.jsx"},{"name":"Input","sourcePath":"components/Input.jsx"},{"name":"Modal","sourcePath":"components/Modal.jsx"},{"name":"ProductListScreen","sourcePath":"components/ProductListScreen.jsx"},{"name":"RequestsScreen","sourcePath":"components/RequestsScreen.jsx"},{"name":"Sidebar","sourcePath":"components/Sidebar.jsx"},{"name":"StatCard","sourcePath":"components/StatCard.jsx"},{"name":"Topbar","sourcePath":"components/Topbar.jsx"}],"sourceHashes":{"components/AuthScreen.jsx":"593d94aa091a","components/Badge.jsx":"1d272e1b6e68","components/Button.jsx":"9c44d8c3e57f","components/Card.jsx":"2ba402a34a6e","components/DashboardScreen.jsx":"149fe44a6d4d","components/Icon.jsx":"67f654a7a80d","components/Input.jsx":"24591ee510e8","components/Modal.jsx":"1cb3ea2af55b","components/ProductListScreen.jsx":"073be288ec57","components/RequestsScreen.jsx":"ad26862d0c58","components/Sidebar.jsx":"8c48e782dd61","components/StatCard.jsx":"3de448d4c7de","components/Topbar.jsx":"87f446813e9d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FlowLABDesignSystem_019df9 = window.FlowLABDesignSystem_019df9 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/Badge.jsx
try { (() => {
const TONES = {
  success: {
    bg: 'rgba(16,185,129,.10)',
    fg: 'var(--success-600)',
    bd: 'rgba(16,185,129,.20)'
  },
  warning: {
    bg: 'rgba(245,158,11,.10)',
    fg: 'var(--warning-600)',
    bd: 'rgba(245,158,11,.20)'
  },
  danger: {
    bg: 'rgba(239,68,68,.10)',
    fg: 'var(--danger-600)',
    bd: 'rgba(239,68,68,.20)'
  },
  info: {
    bg: 'rgba(59,130,246,.10)',
    fg: 'var(--blue-600)',
    bd: 'rgba(59,130,246,.20)'
  },
  neutral: {
    bg: 'rgba(100,116,139,.10)',
    fg: 'var(--slate-600)',
    bd: 'rgba(100,116,139,.20)'
  }
};
function Badge({
  tone = 'neutral',
  children
}) {
  const t = TONES[tone] || TONES.neutral;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      fontSize: 11,
      fontWeight: 600,
      borderRadius: 9999,
      border: `1px solid ${t.bd}`,
      background: t.bg,
      color: t.fg,
      letterSpacing: '.01em',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'currentColor'
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Badge.jsx", error: String((e && e.message) || e) }); }

// components/Card.jsx
try { (() => {
function Card({
  interactive,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#fff',
      border: '1px solid var(--gray-100)',
      borderRadius: 'var(--r-xl)',
      padding: 24,
      boxShadow: 'var(--shadow-sm)',
      transition: interactive ? 'transform .2s, box-shadow .2s, border-color .2s' : undefined,
      ...style
    },
    onMouseEnter: interactive ? e => {
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.boxShadow = '0 10px 40px -10px rgba(0,0,0,.10)';
      e.currentTarget.style.borderColor = 'rgba(59,130,246,.30)';
    } : undefined,
    onMouseLeave: interactive ? e => {
      e.currentTarget.style.transform = 'none';
      e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      e.currentTarget.style.borderColor = 'var(--gray-100)';
    } : undefined
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Card.jsx", error: String((e && e.message) || e) }); }

// components/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PATHS = {
  'layout-dashboard': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "9"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "12",
    width: "7",
    height: "9"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "16",
    width: "7",
    height: "5"
  })),
  'package': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M16.5 9.4 7.55 4.24"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3.27 6.96 12 12.01 20.73 6.96"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "22.08",
    x2: "12",
    y2: "12"
  })),
  'file-text': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "14 2 14 8 20 8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "13",
    x2: "8",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "17",
    x2: "8",
    y2: "17"
  })),
  'building-2': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6 12H4a2 2 0 0 0-2 2v8h4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M18 9h2a2 2 0 0 1 2 2v11h-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 6h4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 10h4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 14h4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 18h4"
  })),
  'calculator': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "2",
    width: "16",
    height: "20",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "8",
    y1: "6",
    x2: "16",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "16",
    y1: "14",
    x2: "16",
    y2: "18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 14h.01M12 14h.01M8 18h.01M12 18h.01"
  })),
  'receipt': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 17.5v-11"
  })),
  'history': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "3 3 3 8 8 8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l4 2"
  })),
  'bell': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
  })),
  'settings': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  })),
  'users': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M22 21v-2a4 4 0 0 0-3-3.87"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 3.13a4 4 0 0 1 0 7.75"
  })),
  'shield': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
  })),
  'plus': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  })),
  'edit': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 20h9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"
  })),
  'trash': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "3 6 5 6 21 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 11v6M14 11v6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
  })),
  'search': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "8"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "21",
    x2: "16.65",
    y2: "16.65"
  })),
  'filter': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polygon", {
    points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
  })),
  'arrow-up-down': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M11 7l-4-4-4 4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 21V3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 17l-4 4-4-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 21V3"
  })),
  'alert-triangle': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "9",
    x2: "12",
    y2: "13"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12.01",
    y2: "17"
  })),
  'check-circle': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M22 11.08V12a10 10 0 1 1-5.93-9.14"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "22 4 12 14.01 9 11.01"
  })),
  'log-in': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "10 17 15 12 10 7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "15",
    y1: "12",
    x2: "3",
    y2: "12"
  })),
  'log-out': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "16 17 21 12 16 7"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "12",
    x2: "9",
    y2: "12"
  })),
  'eye': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  })),
  'eye-off': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "1",
    y1: "1",
    x2: "23",
    y2: "23"
  })),
  'sun': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "5"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "1",
    x2: "12",
    y2: "3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "21",
    x2: "12",
    y2: "23"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4.22",
    y1: "4.22",
    x2: "5.64",
    y2: "5.64"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18.36",
    y1: "18.36",
    x2: "19.78",
    y2: "19.78"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "1",
    y1: "12",
    x2: "3",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "21",
    y1: "12",
    x2: "23",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "4.22",
    y1: "19.78",
    x2: "5.64",
    y2: "18.36"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "18.36",
    y1: "5.64",
    x2: "19.78",
    y2: "4.22"
  })),
  'moon': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })),
  'chevron-down': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  })),
  'chevron-right': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "9 18 15 12 9 6"
  })),
  'chevron-left': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "15 18 9 12 15 6"
  })),
  'x': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })),
  'menu': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "12",
    x2: "21",
    y2: "12"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "6",
    x2: "21",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "3",
    y1: "18",
    x2: "21",
    y2: "18"
  })),
  'arrow-up-right': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "17",
    x2: "17",
    y2: "7"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "7 7 17 7 17 17"
  })),
  'arrow-down-right': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "7",
    y1: "7",
    x2: "17",
    y2: "17"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 7 17 17 7 17"
  })),
  'dollar-sign': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "1",
    x2: "12",
    y2: "23"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
  })),
  'trending-up': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "23 6 13.5 15.5 8.5 10.5 1 18"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "17 6 23 6 23 12"
  })),
  'wrench': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
  })),
  'message-square': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
  })),
  'kanban': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "18",
    height: "18",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 7v10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 7v8"
  })),
  'server': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "20",
    height: "8",
    rx: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "14",
    width: "20",
    height: "8",
    rx: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "6.01",
    y2: "6"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "18",
    x2: "6.01",
    y2: "18"
  })),
  'user-plus': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "8.5",
    cy: "7",
    r: "4"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20",
    y1: "8",
    x2: "20",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "23",
    y1: "11",
    x2: "17",
    y2: "11"
  })),
  'clock': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("polyline", {
    points: "12 6 12 12 16 14"
  })),
  'more-vertical': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "5",
    r: "1"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "19",
    r: "1"
  }))
};
function Icon({
  name,
  size = 18,
  color,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color || 'currentColor',
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: style
  }, rest), PATHS[name] || null);
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Icon.jsx", error: String((e && e.message) || e) }); }

// components/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 'var(--r-lg)',
  fontSize: 14,
  fontWeight: 500,
  fontFamily: 'var(--font-sans)',
  border: 'none',
  cursor: 'pointer',
  transition: 'background-color .15s ease, box-shadow .15s ease, color .15s ease, border-color .15s ease',
  padding: '10px 16px',
  whiteSpace: 'nowrap'
};
const VARIANTS = {
  primary: {
    background: 'var(--grad-primary-btn)',
    color: '#fff',
    boxShadow: 'var(--shadow-blue-glow)'
  },
  secondary: {
    background: '#fff',
    color: 'var(--gray-700)',
    border: '1px solid var(--slate-200)',
    padding: '10px 20px'
  },
  danger: {
    background: 'var(--grad-danger)',
    color: '#fff',
    boxShadow: 'var(--shadow-red-glow)',
    padding: '10px 20px'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--gray-600)',
    padding: '8px 12px'
  },
  icon: {
    background: 'var(--gray-100)',
    color: 'var(--gray-600)',
    padding: 8,
    borderRadius: 'var(--r-lg)'
  }
};
function Button({
  variant = 'primary',
  icon,
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    style: {
      ...BASE,
      ...VARIANTS[variant],
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }), " ", children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Button.jsx", error: String((e && e.message) || e) }); }

// components/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Input({
  label,
  error,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", null, label && /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--slate-700)',
      display: 'block',
      marginBottom: 6
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    style: {
      width: '100%',
      fontFamily: 'var(--font-sans)',
      fontSize: 14,
      padding: '12px 16px',
      borderRadius: 'var(--r-lg)',
      border: `1px solid ${error ? 'var(--danger-500)' : 'var(--slate-300)'}`,
      background: '#fff',
      color: 'var(--gray-900)',
      outline: 'none',
      boxShadow: error ? '0 0 0 3px rgba(239,68,68,.15)' : 'none',
      boxSizing: 'border-box',
      ...style
    }
  }, rest)), error && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--danger-600)',
      marginTop: 4
    }
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Input.jsx", error: String((e && e.message) || e) }); }

// components/AuthScreen.jsx
try { (() => {
const {
  useState
} = React;
const KEYFRAMES = `
@keyframes flAuthBlob { 0%,100% { transform: translate(0,0) scale(1); } 25% { transform: translate(20px,-30px) scale(1.1); } 50% { transform: translate(-20px,20px) scale(.9); } 75% { transform: translate(30px,10px) scale(1.05); } }
@keyframes flAuthSpin { to { transform: rotate(360deg); } }
@keyframes flAuthFadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
@keyframes flAuthScaleIn { from { opacity:0; transform: scale(.96); } to { opacity:1; transform:none; } }
.fl-auth .blob { animation: flAuthBlob 7s ease-in-out infinite; }
.fl-auth .spin-slow { animation: flAuthSpin 8s linear infinite; }
.fl-auth .fade-up { animation: flAuthFadeUp .5s ease-out both; }
.fl-auth .scale-in { animation: flAuthScaleIn .3s ease-out both; }
`;
function AuthScreen({
  onLogin,
  logoSrc = ''
}) {
  const [email, setEmail] = useState('ana.souza@labmed.com.br');
  const [password, setPassword] = useState('senha-secreta');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const submit = e => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onLogin?.();
    }, 800);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "fl-auth",
    style: {
      minHeight: '100vh',
      display: 'flex',
      width: '100%',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("style", {
    dangerouslySetInnerHTML: {
      __html: KEYFRAMES
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      width: '45%',
      minWidth: 480,
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(to bottom right,#1e3a8a,#1e40af,#312e81)',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "blob",
    style: {
      position: 'absolute',
      top: '25%',
      left: -80,
      width: 384,
      height: 384,
      background: 'var(--grad-orb-blue)',
      borderRadius: '50%',
      filter: 'blur(40px)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "blob",
    style: {
      position: 'absolute',
      bottom: '25%',
      right: -80,
      width: 384,
      height: 384,
      background: 'var(--grad-orb-indigo)',
      borderRadius: '50%',
      filter: 'blur(40px)',
      animationDelay: '2s'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: 'linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px)',
      backgroundSize: '64px 64px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "fade-up",
    style: {
      position: 'relative',
      zIndex: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 24,
      maxWidth: 480,
      padding: '48px 56px',
      background: 'rgba(255,255,255,.10)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)',
      borderRadius: 24,
      border: '1px solid rgba(255,255,255,.20)',
      boxShadow: '0 25px 50px -12px rgba(15,23,42,.50)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "spin-slow",
    style: {
      position: 'absolute',
      width: 128,
      height: 128,
      borderRadius: '50%',
      padding: 2,
      background: 'linear-gradient(to right,#1e3a8a,#3b82f6,#1e40af)',
      WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 112,
      height: 112,
      borderRadius: '50%',
      background: 'rgba(255,255,255,.20)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,.30)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 10px 25px -5px rgba(30,58,138,.40)'
    }
  }, logoSrc ? /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "LAB",
    style: {
      width: 80,
      height: 80,
      objectFit: 'contain'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 32,
      color: '#fff'
    }
  }, "L."))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 36,
      fontWeight: 700,
      color: '#fff',
      letterSpacing: '-.02em',
      margin: '0 0 12px'
    }
  }, "FlowLab"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'rgba(191,219,254,.85)',
      fontSize: 15,
      maxWidth: 340,
      lineHeight: 1.5,
      margin: 0
    }
  }, "Sistema de integra\xE7\xE3o operacional do Laborat\xF3rio Lab.")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 96,
      height: 1,
      background: 'linear-gradient(to right,transparent,rgba(255,255,255,.4),transparent)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: 'rgba(255,255,255,.10)',
      borderRadius: 9999,
      border: '1px solid rgba(255,255,255,.15)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: '#34d399'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'rgba(219,234,254,.9)',
      fontSize: 12,
      fontWeight: 500
    }
  }, "7 m\xF3dulos integrados")))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: 'var(--grad-page-auth)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      backgroundImage: 'linear-gradient(rgba(30,58,138,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(30,58,138,.03) 1px,transparent 1px)',
      backgroundSize: '64px 64px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "scale-in",
    style: {
      padding: '48px 32px 32px',
      borderRadius: 24,
      boxShadow: 'var(--shadow-2xl)',
      border: '1px solid rgba(226,232,240,.5)',
      maxWidth: 420,
      width: '100%',
      position: 'relative',
      zIndex: 10,
      background: 'rgba(255,255,255,.80)',
      backdropFilter: 'blur(40px)',
      WebkitBackdropFilter: 'blur(40px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: 32
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 30,
      fontWeight: 700,
      letterSpacing: '-.02em',
      margin: '0 0 4px',
      background: 'var(--grad-headline)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    }
  }, "Bem-vindo"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--slate-500)',
      fontSize: 14,
      margin: 0
    }
  }, "Fa\xE7a login para continuar no FlowLab")), /*#__PURE__*/React.createElement("form", {
    onSubmit: submit,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Input, {
    label: "Email",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    placeholder: "seu@email.com"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: 'var(--slate-700)',
      display: 'block',
      marginBottom: 6
    }
  }, "Senha"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: show ? 'text' : 'password',
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022",
    style: {
      width: '100%',
      fontFamily: 'inherit',
      fontSize: 14,
      padding: '12px 44px 12px 16px',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--slate-300)',
      background: '#fff',
      color: 'var(--gray-900)',
      outline: 'none',
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setShow(!show),
    style: {
      position: 'absolute',
      right: 6,
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--r-lg)',
      padding: 8,
      cursor: 'pointer',
      color: 'var(--gray-500)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: show ? 'eye-off' : 'eye',
    size: 16
  })))), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    type: "submit",
    disabled: loading,
    icon: loading ? undefined : 'log-in',
    style: {
      justifyContent: 'center'
    }
  }, loading ? 'Entrando…' : 'Entrar')), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 32,
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("a", {
    style: {
      color: 'var(--blue-700)',
      fontSize: 14,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, "N\xE3o tem uma conta? Cadastre-se"), /*#__PURE__*/React.createElement("a", {
    style: {
      color: 'var(--slate-500)',
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Esqueci minha senha")))));
}
Object.assign(__ds_scope, { AuthScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/AuthScreen.jsx", error: String((e && e.message) || e) }); }

// components/Modal.jsx
try { (() => {
function Modal({
  open,
  title,
  onClose,
  children,
  footer
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.6)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: '#fff',
      borderRadius: 'var(--r-xl)',
      boxShadow: 'var(--shadow-2xl)',
      maxWidth: 560,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 24px',
      borderBottom: '1px solid var(--gray-100)'
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 600,
      color: 'var(--gray-800)',
      fontFamily: 'var(--font-display)'
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Fechar",
    style: {
      background: 'var(--gray-100)',
      border: 'none',
      borderRadius: 'var(--r-lg)',
      padding: 8,
      cursor: 'pointer',
      color: 'var(--gray-500)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 18
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 24px'
    }
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 24px',
      background: 'var(--gray-50)',
      borderRadius: '0 0 16px 16px',
      display: 'flex',
      gap: 12,
      justifyContent: 'flex-end'
    }
  }, footer)));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Modal.jsx", error: String((e && e.message) || e) }); }

// components/ProductListScreen.jsx
try { (() => {
const DEFAULT_PRODUCTS = [{
  name: 'Tubo EDTA 4 mL',
  code: 'TUB-EDTA-04',
  cat: 'Insumo Técnico',
  stock: 1240,
  status: 'active',
  expiry: '12/2026'
}, {
  name: 'Soro fisiológico 0,9%',
  code: 'SF-09-500',
  cat: 'Uso Geral',
  stock: 38,
  status: 'low-stock',
  expiry: '08/2026'
}, {
  name: 'Reagente HbA1c',
  code: 'REA-HBA-100',
  cat: 'Insumo Técnico',
  stock: 0,
  status: 'expired',
  expiry: '03/2026'
}, {
  name: 'Luvas nitrílicas P',
  code: 'LUV-NIT-P',
  cat: 'Uso Geral',
  stock: 560,
  status: 'active',
  expiry: '06/2027'
}];
const STATUS_LABEL = {
  active: ['Ativo', 'success'],
  'low-stock': ['Estoque baixo', 'warning'],
  expired: ['Vencido', 'danger']
};
function ProductListScreen({
  products = DEFAULT_PRODUCTS
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Card, {
    style: {
      padding: 16,
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      maxWidth: 400
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--slate-400)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar por nome ou c\xF3digo\u2026",
    style: {
      width: '100%',
      padding: '10px 14px 10px 36px',
      fontSize: 13,
      fontFamily: 'inherit',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--slate-300)',
      outline: 'none',
      boxSizing: 'border-box'
    }
  })), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    icon: "filter"
  }, "Categoria"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    icon: "arrow-up-down"
  }, "Status"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    icon: "plus"
  }, "Adicionar produto")), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", {
    style: {
      background: 'var(--gray-50)'
    }
  }, /*#__PURE__*/React.createElement("tr", null, ['Produto', 'Código', 'Categoria', 'Saldo', 'Validade', 'Status', ''].map(h => /*#__PURE__*/React.createElement("th", {
    key: h,
    style: {
      textAlign: h === 'Saldo' ? 'right' : 'left',
      padding: '12px 20px',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.05em',
      textTransform: 'uppercase',
      color: 'var(--gray-500)'
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, products.map(p => {
    const [lbl, tone] = STATUS_LABEL[p.status] || ['—', 'neutral'];
    return /*#__PURE__*/React.createElement("tr", {
      key: p.code,
      style: {
        borderTop: '1px solid var(--gray-100)'
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px',
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--gray-900)'
      }
    }, p.name), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px',
        fontSize: 12,
        fontFamily: 'monospace',
        color: 'var(--gray-600)'
      }
    }, p.code), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
      tone: p.cat === 'Insumo Técnico' ? 'info' : 'neutral'
    }, p.cat)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px',
        textAlign: 'right',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--gray-900)'
      }
    }, p.stock.toLocaleString('pt-BR')), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px',
        fontSize: 13,
        color: 'var(--gray-600)'
      }
    }, p.expiry), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
      tone: tone
    }, lbl)), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: '14px 20px',
        textAlign: 'right',
        display: 'flex',
        gap: 4,
        justifyContent: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: {
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-lg)',
        padding: 8,
        cursor: 'pointer',
        color: 'var(--gray-500)',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "edit",
      size: 16
    })), /*#__PURE__*/React.createElement("button", {
      style: {
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--r-lg)',
        padding: 8,
        cursor: 'pointer',
        color: 'var(--gray-500)',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: "more-vertical",
      size: 16
    }))));
  })))));
}
Object.assign(__ds_scope, { ProductListScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/ProductListScreen.jsx", error: String((e && e.message) || e) }); }

// components/RequestsScreen.jsx
try { (() => {
const DEFAULT_REQUESTS = [{
  id: '#SOL-2026-0188',
  title: 'Compra urgente — Reagentes HbA1c',
  dept: 'Laboratório',
  status: 'Aprovado',
  tone: 'success',
  when: 'há 4 min',
  who: 'Carla Mendes'
}, {
  id: '#SOL-2026-0187',
  title: 'Manutenção centrífuga sala 4',
  dept: 'Manutenção',
  status: 'Em análise',
  tone: 'info',
  when: 'há 2h',
  who: 'Diego Ribeiro'
}, {
  id: '#SOL-2026-0186',
  title: 'Pagamento BioLab Reagentes',
  dept: 'Financeiro',
  status: 'Pendente',
  tone: 'warning',
  when: 'há 5h',
  who: 'Ana Souza'
}];
function RequestsScreen({
  requests = DEFAULT_REQUESTS
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      flexWrap: 'wrap'
    }
  }, [['Todas', true], ['Pendentes', false], ['Em análise', false], ['Aprovadas', false], ['Rejeitadas', false]].map(([l, active]) => /*#__PURE__*/React.createElement("button", {
    key: l,
    style: {
      padding: '6px 14px',
      fontSize: 13,
      borderRadius: 'var(--r-lg)',
      cursor: 'pointer',
      background: active ? 'var(--gray-900)' : '#fff',
      color: active ? '#fff' : 'var(--gray-700)',
      border: active ? 'none' : '1px solid var(--gray-200)'
    }
  }, l)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    icon: "plus"
  }, "Nova solicita\xE7\xE3o")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, requests.map(r => /*#__PURE__*/React.createElement(__ds_scope.Card, {
    key: r.id,
    interactive: true,
    style: {
      padding: 18,
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-lg)',
      background: 'var(--blue-100)',
      color: 'var(--blue-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "file-text",
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontFamily: 'monospace',
      color: 'var(--gray-500)',
      fontWeight: 500
    }
  }, r.id), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 3,
      height: 3,
      borderRadius: '50%',
      background: 'var(--gray-300)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--gray-500)'
    }
  }, r.dept)), /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--gray-900)'
    }
  }, r.title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
      fontSize: 11,
      color: 'var(--gray-500)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "clock",
    size: 12
  }), /*#__PURE__*/React.createElement("span", null, r.when, " \xB7 por ", r.who))), /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: r.tone
  }, r.status), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--gray-400)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 18
  }))))));
}
Object.assign(__ds_scope, { RequestsScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/RequestsScreen.jsx", error: String((e && e.message) || e) }); }

// components/Sidebar.jsx
try { (() => {
const DEFAULT_GROUPS = [{
  id: 'gerencial',
  label: 'Gerencial',
  items: [{
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'layout-dashboard'
  }]
}, {
  id: 'operacoes',
  label: 'Operações',
  items: [{
    id: 'products',
    label: 'Estoque',
    icon: 'package'
  }, {
    id: 'movements',
    label: 'Movimentações',
    icon: 'history'
  }, {
    id: 'requests',
    label: 'Solicitações',
    icon: 'file-text'
  }, {
    id: 'suppliers',
    label: 'Fornecedores',
    icon: 'building-2'
  }, {
    id: 'quotations',
    label: 'Cotações',
    icon: 'calculator'
  }, {
    id: 'billing',
    label: 'Faturamento',
    icon: 'receipt'
  }]
}, {
  id: 'admin',
  label: 'Administração',
  items: [{
    id: 'users',
    label: 'Usuários',
    icon: 'users'
  }, {
    id: 'system',
    label: 'Sistema',
    icon: 'settings'
  }]
}];
function Sidebar({
  groups = DEFAULT_GROUPS,
  active,
  onNavigate,
  onLogout,
  userName = 'Ana Souza',
  userRole = 'Faturamento · Admin'
}) {
  return /*#__PURE__*/React.createElement("aside", {
    style: {
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: 256,
      zIndex: 30,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid rgba(229,231,235,.8)',
      background: 'rgba(255,255,255,.95)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      height: 64,
      padding: '0 16px',
      borderBottom: '1px solid rgba(229,231,235,.8)',
      background: 'var(--grad-sidebar-hdr)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 18,
      background: 'var(--grad-headline)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    }
  }, "FlowLab"), /*#__PURE__*/React.createElement("button", {
    style: {
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--r-lg)',
      padding: 8,
      color: 'var(--gray-500)',
      cursor: 'pointer',
      display: 'flex'
    },
    title: "Tema"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "moon",
    size: 16
  }))), /*#__PURE__*/React.createElement("nav", {
    style: {
      flex: 1,
      padding: '16px 12px',
      overflowY: 'auto'
    }
  }, groups.map((g, gi) => /*#__PURE__*/React.createElement("div", {
    key: g.id
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--slate-500)',
      padding: '0 16px',
      margin: gi === 0 ? '0 0 12px' : '24px 0 12px'
    }
  }, g.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, g.items.map(it => {
    const isActive = active === it.id;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onNavigate?.(it.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--r-lg)',
        fontSize: 14,
        fontWeight: 500,
        textAlign: 'left',
        width: '100%',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color .2s, color .2s, box-shadow .2s',
        background: isActive ? 'var(--grad-primary-btn)' : 'transparent',
        color: isActive ? '#fff' : 'var(--gray-600)',
        boxShadow: isActive ? 'var(--shadow-blue-glow)' : 'none'
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 18
    }), /*#__PURE__*/React.createElement("span", null, it.label));
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid rgba(229,231,235,.8)',
      padding: 12,
      background: 'linear-gradient(to right,#f9fafb,#f8fafc)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 8,
      borderRadius: 'var(--r-lg)',
      background: '#fff',
      boxShadow: 'var(--shadow-sm)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-lg)',
      background: 'linear-gradient(to bottom right,#3b82f6,#6366f1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      boxShadow: 'var(--shadow-blue-glow)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "shield",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 500,
      color: 'var(--gray-800)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, userName), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 11,
      color: 'var(--gray-500)'
    }
  }, userRole)), /*#__PURE__*/React.createElement("button", {
    onClick: onLogout,
    title: "Sair",
    style: {
      background: 'transparent',
      border: 'none',
      borderRadius: 'var(--r-lg)',
      padding: 8,
      cursor: 'pointer',
      color: 'var(--gray-400)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "log-out",
    size: 18
  })))));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/StatCard.jsx
try { (() => {
const TINTS = {
  blue: {
    tint: 'rgba(191,219,254,.65)',
    blob: 'radial-gradient(closest-side, rgba(99,102,241,.22), transparent)',
    iconGrad: 'linear-gradient(135deg,#60a5fa,#2563eb)',
    iconShadow: 'rgba(59,130,246,.45)'
  },
  violet: {
    tint: 'rgba(216,180,254,.55)',
    blob: 'radial-gradient(closest-side, rgba(168,85,247,.22), transparent)',
    iconGrad: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
    iconShadow: 'rgba(139,92,246,.45)'
  },
  green: {
    tint: 'rgba(167,243,208,.55)',
    blob: 'radial-gradient(closest-side, rgba(16,185,129,.22), transparent)',
    iconGrad: 'linear-gradient(135deg,#34d399,#059669)',
    iconShadow: 'rgba(16,185,129,.45)'
  },
  amber: {
    tint: 'rgba(254,215,170,.65)',
    blob: 'radial-gradient(closest-side, rgba(249,115,22,.22), transparent)',
    iconGrad: 'linear-gradient(135deg,#fb923c,#ea580c)',
    iconShadow: 'rgba(249,115,22,.45)'
  }
};
function StatCard({
  tint = 'blue',
  icon,
  value,
  label,
  delta,
  up
}) {
  const t = TINTS[tint] || TINTS.blue;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      padding: '18px 20px 20px',
      borderRadius: 20,
      overflow: 'hidden',
      background: `linear-gradient(135deg, rgba(255,255,255,.85) 0%, rgba(255,255,255,.55) 60%, ${t.tint} 100%)`,
      border: '1px solid rgba(255,255,255,.85)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), inset 0 -1px 0 rgba(15,23,42,.04), 0 1px 0 rgba(15,23,42,.04), 0 12px 32px -16px rgba(15,23,42,.18), 0 4px 10px -6px rgba(15,23,42,.10)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: -30,
      bottom: -40,
      width: 140,
      height: 140,
      borderRadius: '50%',
      background: t.blob,
      filter: 'blur(8px)',
      pointerEvents: 'none'
    }
  }), icon && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 1,
      width: 42,
      height: 42,
      borderRadius: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      background: t.iconGrad,
      boxShadow: `0 8px 18px -6px ${t.iconShadow}, inset 0 1px 0 rgba(255,255,255,.35)`
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 36,
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: '-.02em',
      color: 'var(--gray-900)',
      marginTop: 16,
      position: 'relative',
      zIndex: 1
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.10em',
      textTransform: 'uppercase',
      color: 'var(--slate-500)',
      position: 'relative',
      zIndex: 1
    }
  }, label), delta && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontWeight: 600,
      marginTop: 10,
      position: 'relative',
      zIndex: 1,
      color: up ? 'var(--success-600)' : 'var(--danger-600)'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: up ? 'arrow-up-right' : 'arrow-down-right',
    size: 14
  }), delta));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/DashboardScreen.jsx
try { (() => {
const DEFAULT_STATS = [{
  label: 'Faturado · Abril',
  value: 'R$ 184.220',
  icon: 'dollar-sign',
  tint: 'blue',
  delta: '+12,4% vs. março',
  up: true
}, {
  label: 'Solicitações abertas',
  value: '42',
  icon: 'file-text',
  tint: 'amber',
  delta: '3 atrasadas',
  up: false
}, {
  label: 'Itens com baixa',
  value: '18',
  icon: 'package',
  tint: 'violet',
  delta: '5 críticos',
  up: false
}, {
  label: 'Cotações ativas',
  value: '7',
  icon: 'calculator',
  tint: 'green',
  delta: '2 aguardando',
  up: true
}];
const DEFAULT_ACTIVITY = [{
  who: 'Carla Mendes',
  what: 'aprovou a solicitação',
  obj: '#SOL-2026-0188',
  time: 'há 4 min',
  tag: 'Aprovado',
  tone: 'success'
}, {
  who: 'Sistema',
  what: 'identificou estoque baixo em',
  obj: 'Soro fisiológico 0,9%',
  time: 'há 22 min',
  tag: 'Alerta',
  tone: 'warning'
}, {
  who: 'Diego Ribeiro',
  what: 'enviou cotação para',
  obj: 'BioLab Reagentes',
  time: 'há 1h',
  tag: 'Pendente',
  tone: 'info'
}, {
  who: 'Ana Souza',
  what: 'lançou fatura',
  obj: 'Lote 2026-04 · R$ 184.220',
  time: 'há 3h',
  tag: 'Concluído',
  tone: 'success'
}];
function DashboardScreen({
  stats = DEFAULT_STATS,
  activity = DEFAULT_ACTIVITY
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      background: 'linear-gradient(180deg,#f8fafc,#eef2ff)',
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4,1fr)',
      gap: 20
    }
  }, stats.map(s => /*#__PURE__*/React.createElement(__ds_scope.StatCard, {
    key: s.label,
    tint: s.tint,
    icon: s.icon,
    value: s.value,
    label: s.label,
    delta: s.delta,
    up: s.up
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '2fr 1fr',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--slate-500)',
      margin: '0 0 4px'
    }
  }, "Faturamento"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 18,
      fontWeight: 600,
      color: 'var(--gray-800)',
      fontFamily: 'var(--font-display)'
    }
  }, "Receita por semana")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, ['7d', '30d', '90d'].map((p, i) => /*#__PURE__*/React.createElement("button", {
    key: p,
    style: {
      padding: '4px 12px',
      fontSize: 12,
      borderRadius: 'var(--r-lg)',
      border: 'none',
      cursor: 'pointer',
      background: i === 1 ? 'var(--gray-900)' : 'transparent',
      color: i === 1 ? '#fff' : 'var(--gray-600)'
    }
  }, p)))), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 600 200",
    style: {
      width: '100%',
      height: 200
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("linearGradient", {
    id: "fl-dash-bar",
    x1: "0",
    x2: "0",
    y1: "0",
    y2: "1"
  }, /*#__PURE__*/React.createElement("stop", {
    offset: "0",
    stopColor: "#3b82f6",
    stopOpacity: ".9"
  }), /*#__PURE__*/React.createElement("stop", {
    offset: "1",
    stopColor: "#6366f1",
    stopOpacity: ".7"
  }))), [0.6, 0.45, 0.7, 0.55, 0.85, 0.95, 0.7, 0.8, 1, 0.9, 0.65, 0.78].map((h, i) => /*#__PURE__*/React.createElement("rect", {
    key: i,
    x: 20 + i * 48,
    y: 200 - h * 160,
    width: 28,
    height: h * 160,
    rx: 6,
    fill: "url(#fl-dash-bar)"
  })), [0, 40, 80, 120, 160].map(y => /*#__PURE__*/React.createElement("line", {
    key: y,
    x1: 0,
    x2: 600,
    y1: 200 - y,
    y2: 200 - y,
    stroke: "#f1f5f9",
    strokeWidth: 1
  })))), /*#__PURE__*/React.createElement(__ds_scope.Card, {
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px 12px',
      borderBottom: '1px solid var(--gray-100)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.08em',
      textTransform: 'uppercase',
      color: 'var(--slate-500)',
      margin: '0 0 4px'
    }
  }, "Atividade"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 600,
      color: 'var(--gray-800)',
      fontFamily: 'var(--font-display)'
    }
  }, "\xDAltimas a\xE7\xF5es")), /*#__PURE__*/React.createElement("div", null, activity.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '12px 20px',
      borderBottom: i === activity.length - 1 ? 'none' : '1px solid var(--gray-100)',
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'var(--blue-100)',
      color: 'var(--blue-700)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 11,
      fontWeight: 700,
      flexShrink: 0
    }
  }, a.who.split(' ').map(s => s[0]).slice(0, 2).join('')), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: 'var(--gray-700)',
      lineHeight: 1.4
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 600,
      color: 'var(--gray-900)'
    }
  }, a.who), " ", a.what, " ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontWeight: 600,
      color: 'var(--blue-700)'
    }
  }, a.obj)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: a.tone
  }, a.tag), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--gray-500)'
    }
  }, a.time)))))))));
}
Object.assign(__ds_scope, { DashboardScreen });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// components/Topbar.jsx
try { (() => {
function Topbar({
  title,
  subtitle,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '24px 32px',
      borderBottom: '1px solid var(--gray-100)',
      background: 'rgba(255,255,255,.7)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      fontFamily: 'var(--font-sans)'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 24,
      fontWeight: 700,
      letterSpacing: '-.01em',
      margin: 0,
      color: 'var(--gray-900)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: '2px 0 0',
      fontSize: 13,
      color: 'var(--gray-500)'
    }
  }, subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      color: 'var(--slate-400)',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 16
  })), /*#__PURE__*/React.createElement("input", {
    placeholder: "Pesquisar produtos, lotes, fornecedores\u2026",
    style: {
      padding: '9px 14px 9px 36px',
      width: 340,
      fontSize: 13,
      fontFamily: 'inherit',
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--slate-300)',
      outline: 'none',
      background: '#fff'
    }
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      position: 'relative',
      background: 'var(--gray-100)',
      border: 'none',
      borderRadius: 'var(--r-lg)',
      padding: 8,
      cursor: 'pointer',
      color: 'var(--gray-500)',
      display: 'flex'
    },
    title: "Notifica\xE7\xF5es"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "bell",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 8,
      height: 8,
      background: 'var(--danger-500)',
      borderRadius: '50%',
      border: '2px solid #fff'
    }
  })), action));
}
Object.assign(__ds_scope, { Topbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/Topbar.jsx", error: String((e && e.message) || e) }); }

__ds_ns.AuthScreen = __ds_scope.AuthScreen;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.DashboardScreen = __ds_scope.DashboardScreen;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.ProductListScreen = __ds_scope.ProductListScreen;

__ds_ns.RequestsScreen = __ds_scope.RequestsScreen;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Topbar = __ds_scope.Topbar;

})();
