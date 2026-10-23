// Package groups for the debloat planner.
//
// Every count below is measured: how many of the 248 contributor lists in
// Gathin23/cleanyourtv (cloned as tv-vibehack, commit 3b3f688, 2026-10-23)
// disable that package, parsed from examples/*/debloat.txt with the same rules
// tools/disable.sh uses (comments and blank lines dropped, first token kept).
// "n" is the number of lists of that platform that name the package, "of" the
// number of lists of that platform. The descriptions are the lists' own inline
// comments, shortened. The risk level is mine, from the lists' headers, the
// repo's PROMPT.md and guards, and dumbtv's never-disable file.

export type Risk = "low" | "ask" | "high"

export type Pkg = {
  id: string
  what: string
  n: number
  risk: Risk
  note?: string
}

export type Group = {
  title: string
  pkgs: Pkg[]
}

export type Platform = {
  key: string
  label: string
  of: number
  blurb: string
  groups: Group[]
  never: string[]
}

const GOOGLE: Group[] = [
  {
    title: "Feedback and telemetry",
    pkgs: [
      { id: "com.google.android.feedback", what: "Send feedback", n: 187, risk: "low" },
      { id: "com.android.tv.feedbackconsent", what: "Feedback consent screen", n: 47, risk: "low" },
      { id: "com.google.android.tv.bugreportsender", what: "Bug report uploader", n: 42, risk: "low" },
      { id: "com.google.android.partnersetup", what: "Partner-app attribution", n: 77, risk: "low" },
    ],
  },
  {
    title: "Ad measurement",
    pkgs: [
      { id: "com.android.adservices.api", what: "Privacy Sandbox ad services", n: 35, risk: "low" },
      { id: "com.android.ondevicepersonalization.services", what: "On-device ad personalisation", n: 29, risk: "low" },
      { id: "com.android.federatedcompute.services", what: "Federated ad and usage learning", n: 28, risk: "low" },
    ],
  },
  {
    title: "Preloaded apps",
    pkgs: [
      { id: "com.google.android.play.games", what: "Play Games", n: 149, risk: "low" },
      { id: "com.google.android.videos", what: "Play Movies and TV", n: 110, risk: "low" },
      { id: "com.google.android.youtube.tvmusic", what: "YouTube Music", n: 93, risk: "ask" },
      { id: "android.autoinstalls.config.google.gtvpai", what: "Silently installs partner apps", n: 34, risk: "low" },
      { id: "com.android.printspooler", what: "Printing", n: 66, risk: "low" },
    ],
  },
  {
    title: "Stock home extras",
    pkgs: [
      { id: "com.google.android.tvrecommendations", what: "Recommendation rows for the stock launcher", n: 101, risk: "low" },
      {
        id: "com.google.android.apps.tv.dreamx",
        what: "Ambient screensaver, with promos",
        n: 35,
        risk: "ask",
        note: "Pick another screensaver first, or the TV has none.",
      },
      { id: "com.google.android.backdrop", what: "Ambient screensaver", n: 53, risk: "ask" },
    ],
  },
  {
    title: "Features someone in the house may use",
    pkgs: [
      { id: "com.google.android.katniss", what: "Google Assistant and voice search", n: 85, risk: "ask" },
      { id: "com.google.android.apps.mediashell", what: "Chromecast built-in", n: 32, risk: "ask" },
      {
        id: "com.google.android.marvin.talkback",
        what: "TalkBack screen reader",
        n: 49,
        risk: "ask",
        note: "Only if nobody in the house uses a screen reader.",
      },
      { id: "com.google.android.syncadapters.calendar", what: "Calendar sync", n: 64, risk: "ask" },
    ],
  },
  {
    title: "Home handover (only after the new launcher is Home)",
    pkgs: [
      {
        id: "com.google.android.tungsten.setupwraith",
        what: "Setup wizard; its RecoveryActivity grabs Home",
        n: 92,
        risk: "high",
        note: "If the saved Wi-Fi network belongs to it, disabling it deletes that network and the TV drops off ADB. Check `dumpsys wifi | grep -o 'cname=[^ ]*'` first.",
      },
      {
        id: "com.google.android.apps.tv.launcherx",
        what: "Stock Google TV home",
        n: 28,
        risk: "high",
        note: "Disable only once another launcher answers Home, or the TV has nothing to start.",
      },
      {
        id: "com.google.android.tvlauncher",
        what: "Stock Android TV home",
        n: 24,
        risk: "high",
        note: "Same rule: a replacement must already be Home.",
      },
    ],
  },
]

const GOOGLE_NEVER = [
  "com.android.vending",
  "com.google.android.gms",
  "com.google.android.gsf",
  "com.google.android.inputmethod.latin",
  "com.android.systemui",
  "com.android.tv.settings",
  "com.google.android.permissioncontroller",
  "com.google.android.packageinstaller",
]

export const PLATFORMS: Platform[] = [
  {
    key: "google",
    label: "Android TV / Google TV (any brand)",
    of: 248,
    blurb: "Google's own packages, counted across every list in the repo.",
    groups: GOOGLE,
    never: GOOGLE_NEVER,
  },
  {
    key: "tcl",
    label: "TCL",
    of: 56,
    blurb: "TCL's own layer, on top of the Google packages.",
    groups: [
      {
        title: "Promos, nags and telemetry",
        pkgs: [
          { id: "com.tcl.esticker", what: "Retail demo stickers", n: 49, risk: "low" },
          { id: "com.tcl.messagebox", what: "TCL push messages and promos", n: 41, risk: "low" },
          { id: "com.tcl.partnercustomizer", what: "TCL tweaks to the Google TV home rows", n: 39, risk: "low" },
          { id: "com.tcl.waterfall.overseas", what: "TCL recommendation browser", n: 37, risk: "low" },
          { id: "com.tcl.usercenter", what: "TCL account sign-in nags", n: 37, risk: "low" },
          { id: "com.tcl.tv.tclhome_passive", what: "Pushes TCL content to Home at boot", n: 34, risk: "low" },
          { id: "com.tcl.guard", what: "TCL cleaner and app manager", n: 36, risk: "low" },
          { id: "com.tcl.logkit", what: "Log capture and upload", n: 25, risk: "low" },
          { id: "com.tcl.bi", what: "TCL analytics", n: 24, risk: "low" },
        ],
      },
      {
        title: "Features someone may use",
        pkgs: [
          { id: "com.tcl.ui_mediaCenter", what: "USB media player", n: 28, risk: "ask" },
          { id: "com.tcl.smartalexa", what: "Alexa", n: 27, risk: "ask" },
          { id: "com.tcl.miracast", what: "Miracast screen mirroring", n: 14, risk: "ask" },
          {
            id: "com.tcl.versionUpdateApp",
            what: "System updates",
            n: 8,
            risk: "ask",
            note: "Turning off updates also turns off security fixes.",
          },
        ],
      },
      {
        title: "Breaks something",
        pkgs: [
          {
            id: "com.tcl.suspension",
            what: "Quick Panel",
            n: 2,
            risk: "high",
            note: "The remote's Input key stops working; most TCL lists mark it never-disable.",
          },
        ],
      },
    ],
    never: ["com.tcl.tv", "com.tcl.tvinput", "com.tcl.providers.config", "com.tcl.initsetup", "com.tcl.system.server"],
  },
  {
    key: "sony",
    label: "Sony BRAVIA",
    of: 31,
    blurb: "Sony's own layer, on top of the Google packages.",
    groups: [
      {
        title: "Promos, demos and device agents",
        pkgs: [
          { id: "com.sony.dtv.sonyselect", what: "Sony Select promo tile", n: 27, risk: "low" },
          { id: "com.sony.dtv.da.service", what: "Sony device agent", n: 27, risk: "low" },
          { id: "com.qterics.da.product", what: "Qterics device agent", n: 27, risk: "low" },
          { id: "com.sony.dtv.multiscreendemo", what: "Retail multi-screen demo", n: 25, risk: "low" },
          { id: "com.sony.dtv.demosupport", what: "Retail demo support", n: 24, risk: "low" },
          { id: "com.sony.dtv.promos", what: "My BRAVIA promos", n: 20, risk: "low" },
          { id: "android.autoinstalls.config.sony.bravia", what: "Auto-install of partner apps", n: 18, risk: "low" },
          { id: "com.sony.dtv.sonybugreportsys", what: "Bug report uploader", n: 18, risk: "low" },
        ],
      },
      {
        title: "Content recognition",
        pkgs: [{ id: "tv.samba.ssm", what: "Samba TV, fingerprints what is on screen", n: 25, risk: "low" }],
      },
      {
        title: "Help you might want",
        pkgs: [
          { id: "com.sony.dtv.smarthelp", what: "Smart help", n: 22, risk: "ask" },
          { id: "com.sony.dtv.customersupport", what: "Help tile", n: 21, risk: "ask" },
        ],
      },
    ],
    never: ["com.sony.dtv.tvinput.*", "com.sony.dtv.sonysystemservice", "com.sony.dtv.smartui", "com.mediatek.*"],
  },
  {
    key: "xiaomi",
    label: "Xiaomi / Redmi",
    of: 31,
    blurb: "Xiaomi's PatchWall layer, on top of the Google packages where there are any.",
    groups: [
      {
        title: "Ads and statistics",
        pkgs: [
          { id: "com.xm.webcontent", what: "Webview container for promotions", n: 31, risk: "low" },
          { id: "com.miui.tv.analytics", what: "TV usage statistics", n: 30, risk: "low" },
          { id: "com.xiaomi.statistic", what: "Statistics upload", n: 24, risk: "low" },
          { id: "com.mitv.tvhome.michannel", what: "Mi content rows", n: 17, risk: "low" },
          { id: "com.mitv.tvhome.mitvplus", what: "Mi TV+ sponsored channels", n: 14, risk: "low" },
        ],
      },
      {
        title: "Preloaded apps",
        pkgs: [
          { id: "com.xiaomi.mitv.tvmanager", what: "TV Manager cleaner", n: 20, risk: "low" },
          { id: "com.xiaomi.mimusic2", what: "Mi Music", n: 19, risk: "low" },
          { id: "com.mitv.gallery", what: "Mi Gallery", n: 17, risk: "ask" },
          {
            id: "com.xiaomi.mitv.upgrade",
            what: "Firmware updates",
            n: 4,
            risk: "ask",
            note: "Turning off updates also turns off security fixes.",
          },
        ],
      },
      {
        title: "Home handover",
        pkgs: [
          {
            id: "com.mitv.tvhome.atv",
            what: "PatchWall, the stock home",
            n: 21,
            risk: "high",
            note: "Only once another launcher answers Home.",
          },
        ],
      },
    ],
    never: ["mitv.service", "com.xiaomi.mitv.settings"],
  },
  {
    key: "philips",
    label: "Philips (TP Vision)",
    of: 12,
    blurb: "Philips' droidtv layer, on top of the Google packages.",
    groups: [
      {
        title: "Telemetry and promotion",
        pkgs: [
          { id: "org.droidtv.candeebug", what: "Analytics uploader", n: 9, risk: "low" },
          { id: "org.droidtv.gel", what: "Metrics collector", n: 9, risk: "low" },
          { id: "org.droidtv.nettv.market", what: "App storefront", n: 7, risk: "low" },
          { id: "org.droidtv.nettvrecommender", what: "Top Picks promotion row", n: 7, risk: "low" },
          { id: "org.droidtv.usagelogger", what: "Boot stats and keypress counts", n: 6, risk: "low" },
          { id: "org.droidtv.demome", what: "Retail demo", n: 6, risk: "low" },
        ],
      },
      {
        title: "Features someone may use",
        pkgs: [{ id: "org.droidtv.amazonalexa", what: "Alexa bridge", n: 6, risk: "ask" }],
      },
    ],
    never: ["org.droidtv.eum", "com.tpv_soem.*", "com.mediatek.*"],
  },
  {
    key: "fire",
    label: "Amazon Fire TV",
    of: 11,
    blurb: "Debloat only: Fire OS does not hand Home to another launcher.",
    groups: [
      {
        title: "Ads, shopping and content recognition",
        pkgs: [
          { id: "com.amazon.shoptv.client", what: "Amazon Shopping on TV", n: 10, risk: "low" },
          { id: "com.amazon.sneakpeek", what: "Sponsored previews", n: 8, risk: "low" },
          { id: "com.amazon.tv.acr", what: "Automatic Content Recognition", n: 9, risk: "low" },
        ],
      },
      {
        title: "Telemetry",
        pkgs: [
          { id: "com.amazon.dp.logger", what: "Device log upload", n: 11, risk: "low" },
          { id: "com.amazon.perfcollection", what: "Performance telemetry", n: 10, risk: "low" },
          { id: "com.amazon.wirelessmetrics.service", what: "Wi-Fi metrics upload", n: 10, risk: "low" },
        ],
      },
      {
        title: "Preloaded apps",
        pkgs: [
          { id: "com.amazon.gamehub", what: "Games hub", n: 11, risk: "low" },
          { id: "com.amazon.tmm.tutorial", what: "Remote tutorial", n: 11, risk: "low" },
          { id: "com.amazon.bueller.music", what: "Amazon Music", n: 11, risk: "ask" },
          { id: "com.amazon.bueller.photos", what: "Amazon Photos", n: 11, risk: "ask" },
          {
            id: "com.amazon.tahoe",
            what: "Amazon Kids, or the home's ad tiles",
            n: 8,
            risk: "ask",
            note: "The two repos label this package differently; check `dumpsys package` on your own set.",
          },
        ],
      },
      {
        title: "Breaks something on a Fire TV television",
        pkgs: [
          {
            id: "com.amazon.tv.livetv",
            what: "Live tab, guide and tuner",
            n: 4,
            risk: "high",
            note: "Safe on a stick, which has no tuner. dumbtv lists it as never-disable for Fire TV televisions.",
          },
        ],
      },
    ],
    never: ["com.amazon.tv.launcher", "com.amazon.firehomestarter", "com.amazon.tv.inputpreference.service", "com.amazon.tv.keypolicymanager"],
  },
]
