const CARDNAME = "wizard-clock-card";
const VERSION = "0.12.5-fontface-path-debug";

const debugLogging = false;
const DEFAULT_LOST_STATE = "Lost";
const DEFAULT_TRAVELLING_STATE = "Travelling";
const TRAVELLING_VELOCITY_THRESHOLD = 15;

// Easy default text tuning. These can still be overridden in YAML.
// Positive location offset moves clock-edge labels outward.
// Positive hand offset moves wizard names toward the hand tip.
// Hand text X offset is applied after text rotation, so it stays consistent around the clock.
const DEFAULT_LOCATION_TEXT_OFFSET = 22;
const DEFAULT_LOCATION_TEXT_FONT_SCALE = 1.1;
const DEFAULT_HAND_TEXT_OFFSET = 0;
const DEFAULT_HAND_TEXT_X_OFFSET = -2;
const DEFAULT_HAND_TEXT_FONT_SCALE = 1.1;
const DEFAULT_HAND_LENGTH_SCALE = 0.8;
const DEFAULT_HAND_WIDTH_SCALE = 0.1;
const DEFAULT_HAND_LOCATION_SPREAD = 0.6;
const DEFAULT_LOCATION_ANIMATION_ENABLED = true;
const DEFAULT_LOCATION_ANIMATION_DURATION = 900;
const DEFAULT_LOCATION_ANIMATION_LETTER_STAGGER = 55;
const DEFAULT_LOCATION_ANIMATION_ANGLE_DURATION = 700;
const DEFAULT_LOCATION_TEXT_AUTO_FIT = true;
const DEFAULT_LOCATION_TEXT_MIN_FONT_SCALE = 0.75;
const DEFAULT_LOCATION_TEXT_SLOT_PADDING = 0.88;
const DEFAULT_LOCATION_TEXT_SLOT_GAP = 8;
const DEFAULT_LOCATION_TEXT_WRAP = true;
const DEFAULT_LOCATION_TEXT_MAX_LINES = 2;
const DEFAULT_LOCATION_TEXT_LINE_SPACING = 0.9;
const DEFAULT_LOCATION_TEXT_LINE_GAP = 0;

const DEFAULT_FONT_NAME = "Lumos";
const DEFAULT_FONT_PATH = "/local/community/weasley-card/LUMOS.TTF";
const DEFAULT_FONT_CACHE_BUSTER = "lumos-2"; // change value to refresh font on front end

class WizardClockCard extends HTMLElement {

  // Whenever the state changes, a new `hass` object is set: Update content.
  set hass(hass) {
    if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}set hass start`);
    this._hass = hass;

    // Scale the canvas to fit the available space

    this.availableWidth = Math.min(this.card.offsetWidth, window.innerWidth, window.innerHeight).toFixed(0) - 16;
    if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}availableWidth: ${this.availableWidth}px`);
    if (this.availableWidth <= 0) {
      if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}skipping update`);
      return;
    }
    this.availableWidth = Math.round(Math.min(this.availableWidth, this.configuredWidth));

    // Get information about current locations and wizards

    this.zones = [];
    this.targetstate = [];
    const stateSummary = [];

    var num;
    if (this.config.locations){
      for (num = 0; num < this.config.locations.length; num++){
        if (this.zones.indexOf(this.config.locations[num]) == -1){
          this.zones.push(this.config.locations[num]);
        }
      }
    }
    if (this.config.travelling){
      this.zones.push(this.travellingState);
    }
    if (this.config.lost){
      this.zones.push(this.lostState);
    }

    for (num = 0; num < this.config.wizards.length; num++){
      var stateStr = this.getWizardState(this.config.wizards[num]);
      stateSummary.push(this.getWizardKey(this.config.wizards[num]) + ":" + stateStr);
      if (debugLogging) {
        console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}(${this.config.wizards[num].name}) set hass stateStr: ${stateStr}`);
      }

      if (this.zones.indexOf(stateStr) == -1)  {
        if (typeof(stateStr)!=="string")
          throw new Error("Unable to add state for entity " + this.config.wizards[num].entity + " of type " + typeof(stateStr) + ".");
        this.zones.push(stateStr);
      }
    }

    if (this.zones.length < this.min_location_slots) {
      for (num = this.zones.length; num < this.min_location_slots; num++){
        this.zones.push(' ')
      }
    }
    const renderSignature = [
      this.availableWidth,
      this.configuredWidth,
      stateSummary.join("|"),
      this.zones.join("|"),
      this.testControlsEnabled ? "test-on" : "test-off",
      this.testControlsCollapsed ? "test-collapsed" : "test-open"
    ].join("||");
    const hasPendingRedraw = (this.lastframe && this.lastframe !== 0) || this.hasActiveLocationAnimations() || this.hasActiveVisualEffects();
    if (this.lastHassRenderSignature === renderSignature && this.currentstate && this.currentstate.length && !hasPendingRedraw) {
      this.ensureTestRandomTimers();
      this.updateAvatarOverlays();
      if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}set hass skipped unchanged render`);
      return;
    }
    this.lastHassRenderSignature = renderSignature;

    this.canvas.width = this.configuredWidth;
    this.canvas.height = this.configuredWidth;
    this.canvas.style.width = `${this.availableWidth}px`;
    this.canvas.style.height = `${this.availableWidth}px`;
    this.scaleRatio = this.configuredWidth / this.availableWidth;

    this.radius = this.canvas.height / 2;
    this.ctx.translate(this.radius, this.radius);
    this.radius = this.radius * 0.90;

    if (this.lastframe && this.lastframe != 0){
      cancelAnimationFrame(this.lastframe);
      this.lastframe = 0;
    }
    this.setLocationAnimationTargets(this.zones);
    if (this.locationFilter && this.zones.indexOf(this.locationFilter) === -1) {
      this.clearLocationFilter();
    }

    var obj = this;
    const drawClock = function(){
      obj.lastframe = requestAnimationFrame(function(){
        obj.drawClock();
      });
    };
    const fontLoad = this.loadSelectedFont();
    if (fontLoad) {
      fontLoad.then(drawClock);
    } else {
      drawClock();
    }
    if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}set hass end`);
  }

  // setConfig is called when the configuration changes.
  // Throw an exception and Home Assistant will render an error card.
  setConfig(config) {
    console.info("%c %s %c %s",
      "color: white; background: forestgreen; font-weight: 700;",
      CARDNAME.toUpperCase(),
      "color: forestgreen; background: white; font-weight: 700;",
      VERSION,
    );

    const testConfig = config.test_controls || config.testControls;
    this.rawConfig = config;
    const hasTestWizards = testConfig && Array.isArray(testConfig.wizards) && testConfig.wizards.length;
    if (!config.wizards && !hasTestWizards) {
      throw new Error('You need to define some wizards');
    }

    this.config = this.buildCardConfig(config);
    this.currentstate = [];
    this.lostState = this.config.lost ? this.config.lost : DEFAULT_LOST_STATE;
    this.travellingState = this.config.travelling ? this.config.travelling : DEFAULT_TRAVELLING_STATE;
    this.min_location_slots = this.config.min_location_slots ? this.config.min_location_slots : 0;

    if (this.config.shaft_colour){
      this.shaft_colour = this.config.shaft_colour;
    }
    else {
      this.shaft_colour = this.getThemeColour('primary');
    }

    this.exclude = [];
    if (this.config.exclude){
      for (var num = 0; num < this.config.exclude.length; num++){
        if (this.exclude.indexOf(this.config.exclude[num]) == -1){
          this.exclude.push(this.config.exclude[num]);
        }
      }
    }

    // Set up document canvas.

    this.configuredWidth = this.config.width ? this.config.width : "500";

    this.selectedFont = this.config.fontName || this.config.fontname || this.config.font_name || DEFAULT_FONT_NAME;
    this.fontFallbackName = this.config.fontFallbackName || this.config.fontfallbackname || this.config.font_fallback_name;
    this.fontScale = this.getConfigNumber(this.config, ["font_scale", "fontScale"], 1.1);
    this.locationTextOffset = this.getConfigNumber(
      this.config.location_text,
      ["offset", "radius_offset", "position", "text_to_edge", "textToEdge", "edge_offset", "edgeOffset", "x_offset", "xOffset"],
      this.getConfigNumber(this.config, ["location_text_offset"], DEFAULT_LOCATION_TEXT_OFFSET)
    );
    this.locationTextFontScale = this.getConfigNumber(
      this.config.location_text,
      ["font_scale", "fontScale"],
      this.getConfigNumber(this.config, ["location_font_scale"], DEFAULT_LOCATION_TEXT_FONT_SCALE)
    );
    this.locationTextFontSize = this.getConfigNumber(
      this.config.location_text,
      ["font_size_max", "fontSizeMax", "font_size", "fontSize", "size"],
      this.getConfigNumber(this.config, ["location_font_size"], 0)
    );
    this.locationTextFontSizeMin = this.getConfigNumber(
      this.config.location_text,
      ["font_size_min", "fontSizeMin", "min_size", "minSize"],
      this.getConfigNumber(this.config, ["location_font_size_min"], 0)
    );
    this.locationTextAutoFit = this.getConfigBoolean(
      this.config.location_text,
      ["auto_fit", "autoFit"],
      DEFAULT_LOCATION_TEXT_AUTO_FIT
    );
    this.locationTextMinFontScale = this.getConfigNumber(
      this.config.location_text,
      ["min_font_scale", "minFontScale"],
      DEFAULT_LOCATION_TEXT_MIN_FONT_SCALE
    );
    this.locationTextSlotPadding = this.getConfigNumber(
      this.config.location_text,
      ["slot_padding", "slotPadding"],
      DEFAULT_LOCATION_TEXT_SLOT_PADDING
    );
    this.locationTextSlotGap = this.getConfigNumber(
      this.config.location_text,
      ["slot_gap", "slotGap", "text_gap", "textGap", "side_gap", "sideGap", "fit_gap", "fitGap", "gap"],
      DEFAULT_LOCATION_TEXT_SLOT_GAP
    );
    this.locationTextWrap = this.getConfigBoolean(
      this.config.location_text,
      ["wrap", "multi_line", "multiLine"],
      DEFAULT_LOCATION_TEXT_WRAP
    );
    this.locationTextMaxLines = Math.max(1, Math.round(this.getConfigNumber(
      this.config.location_text,
      ["max_lines", "maxLines"],
      DEFAULT_LOCATION_TEXT_MAX_LINES
    )));
    this.locationTextLineSpacing = this.getConfigNumber(
      this.config.location_text,
      ["line_spacing", "lineSpacing"],
      DEFAULT_LOCATION_TEXT_LINE_SPACING
    );
    this.locationTextLineGap = this.getConfigNumber(
      this.config.location_text,
      ["line_gap", "lineGap", "gap_between_lines", "gapBetweenLines"],
      DEFAULT_LOCATION_TEXT_LINE_GAP
    );
    this.handTextOffset = this.getConfigNumber(
      this.config.hand_text,
      ["offset", "length_offset", "position"],
      this.getConfigNumber(this.config, ["hand_text_offset"], DEFAULT_HAND_TEXT_OFFSET)
    );
    this.handTextXOffset = this.getConfigNumber(
      this.config.hand_text,
      ["x_offset", "cross_offset"],
      this.getConfigNumber(this.config, ["hand_text_x_offset"], DEFAULT_HAND_TEXT_X_OFFSET)
    );
    this.handTextFontScale = this.getConfigNumber(
      this.config.hand_text,
      ["font_scale", "fontScale"],
      this.getConfigNumber(this.config, ["hand_font_scale"], DEFAULT_HAND_TEXT_FONT_SCALE)
    );
    this.handLengthScale = this.getConfigNumber(
      this.config.hands,
      ["length_scale", "lengthScale"],
      this.getConfigNumber(this.config, ["hand_length_scale"], DEFAULT_HAND_LENGTH_SCALE)
    );
    this.handWidthScale = this.getConfigNumber(
      this.config.hands,
      ["width_scale", "widthScale"],
      this.getConfigNumber(this.config, ["hand_width_scale"], DEFAULT_HAND_WIDTH_SCALE)
    );
    this.handLocationSpread = this.getConfigNumber(
      this.config.hands,
      ["location_spread", "spread", "locationSpread"],
      this.getConfigNumber(this.config, ["hand_location_spread"], DEFAULT_HAND_LOCATION_SPREAD)
    );
    this.locationAnimationEnabled = this.getConfigBoolean(
      this.config.location_animation,
      ["enabled"],
      DEFAULT_LOCATION_ANIMATION_ENABLED
    );
    this.locationAnimationDuration = this.getConfigNumber(
      this.config.location_animation,
      ["duration", "duration_ms", "durationMs"],
      DEFAULT_LOCATION_ANIMATION_DURATION
    );
    this.locationAnimationLetterStagger = this.getConfigNumber(
      this.config.location_animation,
      ["letter_stagger", "letter_stagger_ms", "letterStagger"],
      DEFAULT_LOCATION_ANIMATION_LETTER_STAGGER
    );
    this.locationAnimationAngleDuration = this.getConfigNumber(
      this.config.location_animation,
      ["angle_duration", "angle_duration_ms", "angleDuration"],
      DEFAULT_LOCATION_ANIMATION_ANGLE_DURATION
    );
    this.configureInteractiveEffects();
    this.showVersion = this.getConfigBoolean(
      this.config,
      ["show_version", "showVersion", "debug_version", "debugVersion"],
      false
    );
    this.testControlsConfig = this.config.test_controls || this.config.testControls;
    this.testControlsEnabled = this.isTestViewActive(this.config);
    if (!this.testStateOverrides) {
      this.testStateOverrides = {};
    }
    if (!this.testRandomStates) {
      this.testRandomStates = {};
    }
    if (!this.testRandomTimers) {
      this.testRandomTimers = {};
    }
    if (!this.testRandomZoneStates) {
      this.testRandomZoneStates = {};
    }
    this.testControlsCollapsed = this.getConfigBoolean(
      this.config,
      ["test_controls_hidden", "testControlsHidden", "test_controls_collapsed", "testControlsCollapsed"],
      this.testControlsCollapsed === undefined ? false : this.testControlsCollapsed
    );
    if (!this.testUnlockClicks) {
      this.testUnlockClicks = [];
    }
    if (!this.testControlsEnabled) {
      this.stopAllTestRandomTimers();
    }
    this.configureInitialTestStates();
    this.configureFont();

    if (!this.canvas) {
      this.card = document.createElement('ha-card');
      if (this.config.header) {
        this.card.header = this.config.header;
      }

      this.div = document.createElement('div');
      this.div.style.textAlign = 'center';
      this.div.style.position = 'relative';
      this.canvas = document.createElement('canvas');
      this.canvas.style.cursor = 'pointer';
      const obj = this;
      this.canvas.addEventListener('click', function(event) {
        obj.handleCanvasClick(event);
      });
      this.div.appendChild(this.canvas);
      this.avatarOverlayDiv = document.createElement('div');
      this.avatarOverlayDiv.style.position = 'absolute';
      this.avatarOverlayDiv.style.left = '0';
      this.avatarOverlayDiv.style.top = '0';
      this.avatarOverlayDiv.style.width = '100%';
      this.avatarOverlayDiv.style.height = '100%';
      this.avatarOverlayDiv.style.pointerEvents = 'none';
      this.avatarOverlayDiv.style.overflow = 'visible';
      this.div.appendChild(this.avatarOverlayDiv);
      this.versionDiv = document.createElement('div');
      this.versionDiv.style.display = 'none';
      this.versionDiv.style.padding = '0 8px 8px';
      this.versionDiv.style.fontFamily = 'Arial, sans-serif';
      this.versionDiv.style.fontSize = '11px';
      this.versionDiv.style.lineHeight = '1.35';
      this.versionDiv.style.opacity = '0.7';
      this.versionDiv.style.wordBreak = 'break-word';
      this.div.appendChild(this.versionDiv);
      this.testControlsDiv = document.createElement('div');
      this.testControlsDiv.style.display = 'none';
      this.testControlsDiv.style.padding = '0 8px 12px';
      this.testControlsDiv.style.fontFamily = 'Arial, sans-serif';
      this.testControlsDiv.style.fontSize = '12px';
      this.testControlsDiv.style.textAlign = 'left';
      this.div.appendChild(this.testControlsDiv);
      this.card.appendChild(this.div);
      this.appendChild(this.card);
      if (!this.canvas.getContext)
        throw new Error("Browser does not support " + CARDNAME + " canvas.");
      this.ctx = this.canvas.getContext("2d");

      /* watch for changes in the size of the card */
      const observer = createResizeObserver(this);
      observer.observe(this.card);
    }
    this.updateVersionDebug();
    this.updateTestControls();
    if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}getConfig end`);
  }

  buildCardConfig(config) {
    const cardConfig = Object.assign({}, config);
    const baseWizards = Array.isArray(config.wizards) ? config.wizards.slice() : [];
    const testConfig = config.test_controls || config.testControls;
    const testEnabled = this.isTestViewActive(config);
    const testWizards = testConfig && Array.isArray(testConfig.wizards) ? testConfig.wizards : [];
    const existingKeys = {};

    for (var num = 0; num < baseWizards.length; num++) {
      existingKeys[this.getWizardKey(baseWizards[num])] = true;
    }

    cardConfig.wizards = baseWizards.slice();
    if (!testEnabled) {
      return cardConfig;
    }

    for (var testNum = 0; testNum < testWizards.length; testNum++) {
      const wizard = Object.assign({}, testWizards[testNum]);
      if (!wizard.name) {
        wizard.name = "Test Wizard " + (testNum + 1);
      }
      if (!wizard.entity) {
        wizard.entity = "test." + this.slugify(wizard.name);
      }
      wizard._test_control = true;

      const wizardKey = this.getWizardKey(wizard);
      if (!existingKeys[wizardKey]) {
        cardConfig.wizards.push(wizard);
        existingKeys[wizardKey] = true;
      }
    }

    return cardConfig;
  }

  isTestControlsEnabled(config) {
    const testConfig = config ? (config.test_controls || config.testControls) : undefined;
    return this.getConfigBoolean(
      config,
      ["test_enable", "testEnable", "test_enabled", "testEnabled"],
      this.getConfigBoolean(testConfig, ["enabled"], false)
    );
  }

  isTestViewHidden(config) {
    return this.getConfigBoolean(
      config,
      ["test_view_hidden", "testViewHidden", "test_hidden", "testHidden"],
      false
    );
  }

  isTestUnlockEnabled(config) {
    return this.getConfigBoolean(
      config,
      ["test_unlock_clicks", "testUnlockClicks", "test_click_unlock", "testClickUnlock"],
      this.isTestViewHidden(config)
    );
  }

  isTestViewActive(config) {
    return this.isTestControlsEnabled(config) &&
      !this.testViewForceHidden &&
      (!this.isTestViewHidden(config) || this.testViewUnlocked);
  }

  configureInteractiveEffects() {
    this.arrivalSparkleConfig = this.config.arrival_sparkle || this.config.arrivalSparkle || {};
    this.arrivalSparkleEnabled = this.getConfigBoolean(this.arrivalSparkleConfig, ["enabled"], false);
    this.arrivalSparkleDuration = this.getConfigNumber(this.arrivalSparkleConfig, ["duration", "duration_ms", "durationMs"], 1400);
    this.arrivalSparkleCount = Math.max(1, Math.round(this.getConfigNumber(this.arrivalSparkleConfig, ["count", "sparkles"], 10)));
    this.arrivalSparkleRadius = this.getConfigNumber(this.arrivalSparkleConfig, ["radius"], 22);

    this.handTrailConfig = this.config.hand_trail || this.config.handTrail || {};
    this.handTrailEnabled = this.getConfigBoolean(this.handTrailConfig, ["enabled"], false);
    this.handTrailLength = Math.max(1, Math.round(this.getConfigNumber(this.handTrailConfig, ["length", "steps"], 12)));
    this.handTrailAlpha = this.getConfigNumber(this.handTrailConfig, ["alpha", "opacity"], 0.22);
    this.handTrailWidthScale = this.getConfigNumber(this.handTrailConfig, ["width_scale", "widthScale"], 0.85);

    this.locationFilterConfig = this.config.location_filter || this.config.locationFilter || {};
    this.locationFilterEnabled = this.getConfigBoolean(this.locationFilterConfig, ["enabled"], false);
    this.locationFilterDimAlpha = this.getConfigNumber(this.locationFilterConfig, ["dim_alpha", "dimAlpha", "alpha"], 0.25);
    this.locationFilterSpread = this.getConfigNumber(this.locationFilterConfig, ["spread", "selected_spread", "selectedSpread", "fan_spread", "fanSpread"], this.handLocationSpread * 1.8);
    this.locationFilterAutoOff = this.getConfigNumber(this.locationFilterConfig, ["auto_off", "autoOff", "auto_off_ms", "autoOffMs"], 0);

    this.recentMovementConfig = this.config.recent_movement || this.config.recentMovement || {};
    this.recentMovementEnabled = this.getConfigBoolean(this.recentMovementConfig, ["enabled"], false);
    this.recentMovementDuration = this.getConfigNumber(this.recentMovementConfig, ["duration", "duration_ms", "durationMs"], 5 * 60 * 1000);
    this.recentMovementGlowBlur = this.getConfigNumber(this.recentMovementConfig, ["glow_blur", "glowBlur"], 18);
    this.recentMovementFadeIn = this.getConfigNumber(this.recentMovementConfig, ["fade_in", "fade_in_ms", "fadeIn", "fadeInMs"], 1000);
    this.recentMovementFrameMs = Math.max(100, this.getConfigNumber(this.recentMovementConfig, ["frame_ms", "frameMs", "redraw_ms", "redrawMs"], 300));

    this.avatarConfig = this.config.avatars || this.config.avatar_tips || this.config.avatarTips || {};
    this.avatarsEnabled = this.getConfigBoolean(this.avatarConfig, ["enabled"], false);
    this.avatarMode = this.avatarConfig.mode || "default";
    this.avatarSize = this.getConfigNumber(this.avatarConfig, ["size"], 34);
    this.avatarRingWidth = this.getConfigNumber(this.avatarConfig, ["ring_width", "ringWidth"], 3);
    this.avatarOffset = this.getConfigNumber(this.avatarConfig, ["offset", "y_offset", "yOffset", "hand_offset", "handOffset"], 0);
    this.avatarShowName = this.getConfigBoolean(this.avatarConfig, ["show_name", "showName", "show_text", "showText"], true);
    this.avatarRingColour = this.avatarConfig.ring_colour || this.avatarConfig.ringColor || this.avatarConfig.ring_color;
    this.avatarImageBasePath = this.avatarConfig.image_path || this.avatarConfig.imagePath || this.avatarConfig.base_path || this.avatarConfig.basePath || "/hacsfiles/weasley-card/";
    this.avatarImageUp = this.getConfigBoolean(this.avatarConfig, ["image_up", "imageUp", "always_up", "alwaysUp"], false);

    if (!this.previousWizardLocations) {
      this.previousWizardLocations = {};
    }
    if (!this.wizardMovedAt) {
      this.wizardMovedAt = {};
    }
    if (!this.arrivalSparkles) {
      this.arrivalSparkles = [];
    }
    if (!this.handTrails) {
      this.handTrails = {};
    }
    if (!this.avatarImages) {
      this.avatarImages = {};
    }
    if (!this.locationFilterEnabled) {
      this.clearLocationFilter();
    }
  }

  colorWithAlpha(colour, alpha) {
    if (!colour) {
      return "rgba(255, 255, 255, " + alpha + ")";
    }

    const color = String(colour).trim();
    if (color[0] === "#") {
      const hex = color.substring(1);
      const normalized = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
      if (normalized.length === 6) {
        const red = parseInt(normalized.substring(0, 2), 16);
        const green = parseInt(normalized.substring(2, 4), 16);
        const blue = parseInt(normalized.substring(4, 6), 16);
        return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
      }
    }

    return colour;
  }

  refreshThemeColours() {
    const styles = getComputedStyle(document.documentElement);
    this.themeColours = {
      primary: styles.getPropertyValue('--primary-color') || '#cc5500',
      primaryText: styles.getPropertyValue('--primary-text-color') || '#ffffff',
      primaryBackground: styles.getPropertyValue('--primary-background-color') || '#000000',
      secondaryBackground: styles.getPropertyValue('--secondary-background-color') || '#242424',
    };
  }

  getThemeColour(name) {
    if (!this.themeColours) {
      this.refreshThemeColours();
    }

    return this.themeColours[name];
  }

  normalizeLocationName(location) {
    return String(location || "").trim().toLowerCase();
  }

  hasHandsAtLocation(location) {
    if (!this.locationHandCounts) {
      return false;
    }

    return Boolean(this.locationHandCounts[this.normalizeLocationName(location)]);
  }

  getHandCountAtLocation(location) {
    if (!this.locationHandCounts) {
      return 0;
    }

    return this.locationHandCounts[this.normalizeLocationName(location)] || 0;
  }

  isLocationFilterable(location) {
    return this.getHandCountAtLocation(location) >= 2;
  }

  setLocationFilter(location) {
    this.clearLocationFilterTimer();
    this.locationFilter = location;
    this.locationFilterExpiresAt = undefined;
    if (!this.locationFilter || !this.locationFilterAutoOff || this.locationFilterAutoOff <= 0) {
      return;
    }

    this.locationFilterExpiresAt = this.getAnimationNow() + this.locationFilterAutoOff;
    const obj = this;
    this.locationFilterTimer = setTimeout(function(){
      obj.clearLocationFilter();
      obj.requestClockRedraw();
    }, this.locationFilterAutoOff);
  }

  clearLocationFilter() {
    this.locationFilter = undefined;
    this.locationFilterExpiresAt = undefined;
    this.clearLocationFilterTimer();
  }

  clearLocationFilterTimer() {
    if (!this.locationFilterTimer) {
      return;
    }

    clearTimeout(this.locationFilterTimer);
    this.locationFilterTimer = undefined;
  }

  updateLocationFilterAutoOff(now) {
    if (!this.locationFilter || !this.locationFilterExpiresAt) {
      return false;
    }

    if (now < this.locationFilterExpiresAt) {
      return true;
    }

    this.clearLocationFilter();
    return false;
  }

  requestClockRedraw() {
    if (this.lastframe && this.lastframe !== 0) {
      return;
    }

    const obj = this;
    this.lastframe = requestAnimationFrame(function(){
      obj.drawClock();
    });
  }

  requestClockRedrawDelayed(delay) {
    if (this.lastframe && this.lastframe !== 0) {
      return;
    }
    if (this.redrawTimer) {
      return;
    }

    const obj = this;
    this.redrawTimer = setTimeout(function(){
      obj.redrawTimer = undefined;
      obj.requestClockRedraw();
    }, Math.max(0, delay));
  }

  hasActiveVisualEffects() {
    const now = this.getAnimationNow();
    if (this.updateLocationFilterAutoOff(now)) {
      return true;
    }

    if (this.arrivalSparkleEnabled && this.arrivalSparkles) {
      for (var sparkleNum = 0; sparkleNum < this.arrivalSparkles.length; sparkleNum++) {
        if (now - this.arrivalSparkles[sparkleNum].start < this.arrivalSparkleDuration) {
          return true;
        }
      }
    }

    if (this.recentMovementEnabled && this.wizardMovedAt) {
      for (const wizardKey in this.wizardMovedAt) {
        if (now - this.wizardMovedAt[wizardKey] < this.recentMovementFadeIn + this.recentMovementDuration) {
          this.requestClockRedrawDelayed(this.recentMovementFrameMs);
          return false;
        }
      }
    }

    return false;
  }

  getAngleDistance(first, second) {
    return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
  }

  recordWizardMovement(wizard, locationName, angle, length) {
    const wizardKey = this.getWizardKey(wizard);
    if (!wizardKey || locationName === undefined || locationName === null) {
      return;
    }

    const stateName = String(locationName);
    const previousLocation = this.previousWizardLocations[wizardKey];
    if (previousLocation !== undefined && previousLocation !== stateName) {
      const now = this.getAnimationNow();
      this.wizardMovedAt[wizardKey] = now;
      if (this.arrivalSparkleEnabled) {
        this.addArrivalSparkle(wizardKey, angle, length, wizard.colour);
      }
    }

    this.previousWizardLocations[wizardKey] = stateName;
  }

  addArrivalSparkle(wizardKey, pos, length, colour) {
    if (!this.arrivalSparkles) {
      this.arrivalSparkles = [];
    }

    this.arrivalSparkles.push({
      wizardKey: wizardKey,
      pos: pos,
      length: length,
      colour: colour,
      start: this.getAnimationNow()
    });
  }

  drawArrivalSparkles(ctx) {
    if (!this.arrivalSparkleEnabled || !this.arrivalSparkles || !this.arrivalSparkles.length) {
      return;
    }

    const now = this.getAnimationNow();
    const activeSparkles = [];
    for (var sparkleNum = 0; sparkleNum < this.arrivalSparkles.length; sparkleNum++) {
      const sparkle = this.arrivalSparkles[sparkleNum];
      const rawProgress = (now - sparkle.start) / Math.max(1, this.arrivalSparkleDuration);
      if (rawProgress >= 1) {
        continue;
      }

      activeSparkles.push(sparkle);
      const progress = this.easeOutCubic(this.clamp(rawProgress, 0, 1));
      const alpha = 1 - rawProgress;
      const tipX = Math.sin(sparkle.pos) * sparkle.length;
      const tipY = -Math.cos(sparkle.pos) * sparkle.length;
      const travelRadius = this.arrivalSparkleRadius * (0.35 + progress);
      const baseColour = sparkle.colour || this.getThemeColour('primary');

      for (var dotNum = 0; dotNum < this.arrivalSparkleCount; dotNum++) {
        const dotAngle = (dotNum / this.arrivalSparkleCount) * Math.PI * 2 + (sparkleNum * 0.7);
        const dotDistance = travelRadius * (0.55 + ((dotNum % 3) * 0.18));
        ctx.beginPath();
        ctx.fillStyle = this.colorWithAlpha(baseColour, alpha * (0.45 + (dotNum % 2) * 0.35));
        ctx.arc(
          tipX + Math.cos(dotAngle) * dotDistance,
          tipY + Math.sin(dotAngle) * dotDistance,
          Math.max(1.5, (1 - progress) * 4),
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
    }

    this.arrivalSparkles = activeSparkles;
  }

  updateHandTrail(hand) {
    if (!this.handTrailEnabled || !hand || !hand.wizardKey) {
      return;
    }

    if (!this.handTrails) {
      this.handTrails = {};
    }

    const trail = this.handTrails[hand.wizardKey] || [];
    if (!hand.moving) {
      this.handTrails[hand.wizardKey] = [];
      return;
    }

    const lastSample = trail.length ? trail[trail.length - 1] : undefined;
    if (!lastSample || this.getAngleDistance(hand.pos, lastSample.pos) > 0.004) {
      trail.push({
        pos: hand.pos,
        length: hand.length,
        width: hand.width * this.handTrailWidthScale,
        colour: hand.colour,
        textcolour: hand.textcolour
      });
    }

    while (trail.length > this.handTrailLength) {
      trail.shift();
    }
    this.handTrails[hand.wizardKey] = trail;
  }

  drawHandTrail(ctx, hand) {
    if (!this.handTrailEnabled || !hand || !hand.wizardKey || !this.handTrails || !this.handTrails[hand.wizardKey]) {
      return;
    }

    const trail = this.handTrails[hand.wizardKey];
    if (!hand.moving || trail.length < 2) {
      return;
    }

    for (var num = 0; num < trail.length; num++) {
      const sample = trail[num];
      const alpha = this.handTrailAlpha * ((num + 1) / Math.max(1, trail.length));
      this.drawHand(ctx, sample.pos, sample.length, sample.width, hand.wizard, sample.colour, sample.textcolour, {
        alpha: alpha,
        drawText: false,
        drawAvatar: false,
        shadow: false
      });
    }
  }

  getHandDrawOptions(hand) {
    const options = {
      alpha: 1,
      drawText: true,
      handText: hand.handText,
      handTextOffset: hand.handTextOffset,
      handTextXOffset: hand.handTextXOffset,
      handTextFontScale: hand.handTextFontScale,
      handTextFontSize: hand.handTextFontSize,
      drawAvatar: this.avatarsEnabled,
      avatarMode: hand.avatarMode,
      avatarUrl: hand.avatarUrl,
      avatarOffset: hand.avatarOffset,
      avatarRingColour: hand.avatarRingColour,
      avatarImageUp: hand.avatarImageUp,
      handPos: hand.pos,
      glowAlpha: 0
    };

    if (this.locationFilterEnabled && this.locationFilter && this.normalizeLocationName(hand.locationName) !== this.normalizeLocationName(this.locationFilter)) {
      options.alpha = this.locationFilterDimAlpha;
    }

    if (this.recentMovementEnabled && this.wizardMovedAt && this.wizardMovedAt[hand.wizardKey] !== undefined) {
      const age = this.getAnimationNow() - this.wizardMovedAt[hand.wizardKey];
      const fadeIn = Math.max(0, this.recentMovementFadeIn);
      const totalDuration = fadeIn + this.recentMovementDuration;
      if (age < totalDuration) {
        if (fadeIn > 0 && age < fadeIn) {
          options.glowAlpha = this.easeOutCubic(age / fadeIn);
        } else {
          options.glowAlpha = 1 - ((age - fadeIn) / Math.max(1, this.recentMovementDuration));
        }
      }
    }

    options.drawText = hand.avatarShowName !== false;

    return options;
  }

  getWizardHandTextConfig(wizard) {
    return wizard.hand_text || wizard.handText || {};
  }

  getWizardHandText(wizard) {
    const handTextConfig = this.getWizardHandTextConfig(wizard);
    const configuredText = handTextConfig.name !== undefined ? handTextConfig.name :
      (handTextConfig.text !== undefined ? handTextConfig.text :
        (handTextConfig.label !== undefined ? handTextConfig.label :
          (wizard.hand_name !== undefined ? wizard.hand_name :
            (wizard.handName !== undefined ? wizard.handName : undefined))));
    return configuredText !== undefined && configuredText !== null ? String(configuredText) : wizard.name;
  }

  getWizardHandTextOffset(wizard) {
    return this.getConfigNumber(
      this.getWizardHandTextConfig(wizard),
      ["offset", "y_offset", "yOffset", "length_offset", "position"],
      this.getConfigNumber(wizard, ["hand_text_offset", "handTextOffset"], this.handTextOffset)
    );
  }

  getWizardHandTextXOffset(wizard) {
    return this.getConfigNumber(
      this.getWizardHandTextConfig(wizard),
      ["x_offset", "xOffset", "cross_offset", "crossOffset"],
      this.getConfigNumber(wizard, ["hand_text_x_offset", "handTextXOffset"], this.handTextXOffset)
    );
  }

  getWizardHandTextFontScale(wizard) {
    return this.getConfigNumber(
      this.getWizardHandTextConfig(wizard),
      ["font_scale", "fontScale", "scale"],
      this.getConfigNumber(wizard, ["hand_font_scale", "handFontScale"], this.handTextFontScale)
    );
  }

  getWizardHandTextFontSize(wizard) {
    return this.getConfigNumber(
      this.getWizardHandTextConfig(wizard),
      ["font_size", "fontSize", "size"],
      this.getConfigNumber(wizard, ["hand_font_size", "handFontSize"], 0)
    );
  }

  getWizardAvatarMode(wizard) {
    const value = wizard.avatar || wizard.avatar_mode || wizard.avatarMode;
    if (value === false || String(value).toLowerCase() === "none" || String(value).toLowerCase() === "off") {
      return "none";
    }
    if (value === true || String(value).toLowerCase() === "avatar") {
      return "avatar";
    }
    if (!value && (wizard.avatar_url || wizard.avatarUrl || wizard.avatar_image || wizard.avatarImage || wizard.picture || wizard.image)) {
      return "image";
    }
    return value || this.avatarMode || "default";
  }

  getWizardAvatarUrl(wizard) {
    const explicit = wizard.avatar_url || wizard.avatarUrl || wizard.avatar_image || wizard.avatarImage || wizard.picture || wizard.image;
    if (explicit) {
      return this.normalizeAvatarUrl(explicit);
    }

    const entityId = wizard.avatar_entity || wizard.avatarEntity || wizard.person_entity || wizard.personEntity || wizard.more_info_entity || wizard.moreInfoEntity || wizard.entity;
    const entity = this._hass && this._hass.states ? this._hass.states[entityId] : undefined;
    return entity && entity.attributes ? entity.attributes.entity_picture : undefined;
  }

  getWizardAvatarOffset(wizard) {
    return this.getConfigNumber(
      wizard,
      ["avatar_offset", "avatarOffset", "avatar_y_offset", "avatarYOffset", "avatar_hand_offset", "avatarHandOffset"],
      this.avatarOffset
    );
  }

  getWizardAvatarShowName(wizard) {
    return this.getConfigBoolean(
      wizard,
      ["show_name", "showName", "show_hand_name", "showHandName", "avatar_show_name", "avatarShowName"],
      this.avatarShowName
    );
  }

  getWizardAvatarRingColour(wizard) {
    return wizard.avatar_ring_colour || wizard.avatarRingColour || wizard.avatar_ring_color || wizard.avatarRingColor || this.avatarRingColour;
  }

  getWizardAvatarImageUp(wizard) {
    return this.getConfigBoolean(
      wizard,
      ["image_up", "imageUp", "avatar_image_up", "avatarImageUp", "always_up", "alwaysUp"],
      this.avatarImageUp
    );
  }

  normalizeAvatarUrl(url) {
    const value = String(url || "").trim();
    if (!value || value.indexOf("/") === 0 || value.indexOf("http://") === 0 || value.indexOf("https://") === 0 || value.indexOf("data:") === 0 || value.indexOf("blob:") === 0) {
      return value;
    }

    const basePath = String(this.avatarImageBasePath || "/hacsfiles/weasley-card/");
    return basePath.replace(/\/?$/, "/") + value;
  }

  isAnimatedAvatarUrl(url) {
    return /\.gif($|\?)/i.test(String(url || ""));
  }

  getAvatarImage(url) {
    if (!url || typeof Image === "undefined") {
      return undefined;
    }

    if (!this.avatarImages) {
      this.avatarImages = {};
    }

    if (this.avatarImages[url]) {
      if (this.isAnimatedAvatarUrl(url)) {
        this.ensureAvatarImagePark(this.avatarImages[url]);
      }
      return this.avatarImages[url];
    }

    const image = new Image();
    const obj = this;
    image.onload = function(){
      obj.requestClockRedraw();
    };
    image.onerror = function(){
      image._wizardClockFailed = true;
    };
    image.src = url;
    this.avatarImages[url] = image;
    if (this.isAnimatedAvatarUrl(url)) {
      this.ensureAvatarImagePark(image);
    }
    return image;
  }

  ensureAvatarImagePark(image) {
    if (!image || image._wizardClockParked || typeof document === "undefined") {
      return;
    }

    if (!this.avatarImagePark) {
      this.avatarImagePark = document.createElement("div");
      this.avatarImagePark.style.position = "fixed";
      this.avatarImagePark.style.left = "-10000px";
      this.avatarImagePark.style.top = "-10000px";
      this.avatarImagePark.style.width = "1px";
      this.avatarImagePark.style.height = "1px";
      this.avatarImagePark.style.overflow = "hidden";
      this.avatarImagePark.style.opacity = "0";
      this.avatarImagePark.setAttribute("aria-hidden", "true");
      (document.body || document.documentElement).appendChild(this.avatarImagePark);
    }

    this.avatarImagePark.appendChild(image);
    image._wizardClockParked = true;
  }

  shouldUseAvatarOverlay(options) {
    return Boolean(
      options &&
      options.drawAvatar &&
      (options.avatarMode === "avatar" || options.avatarMode === "image") &&
      this.isAnimatedAvatarUrl(options.avatarUrl)
    );
  }

  ensureAvatarOverlayContainer() {
    if (this.avatarOverlayDiv || !this.div) {
      return;
    }

    this.avatarOverlayDiv = document.createElement('div');
    this.avatarOverlayDiv.style.position = 'absolute';
    this.avatarOverlayDiv.style.left = '0';
    this.avatarOverlayDiv.style.top = '0';
    this.avatarOverlayDiv.style.width = '100%';
    this.avatarOverlayDiv.style.height = '100%';
    this.avatarOverlayDiv.style.pointerEvents = 'none';
    this.avatarOverlayDiv.style.overflow = 'visible';
    this.div.appendChild(this.avatarOverlayDiv);
  }

  getAvatarOverlay(hand) {
    this.ensureAvatarOverlayContainer();
    if (!this.avatarOverlayDiv || !hand || !hand.wizardKey) {
      return undefined;
    }

    const key = this.slugify(hand.wizardKey);
    if (!this.avatarOverlayImages) {
      this.avatarOverlayImages = {};
    }

    if (!this.avatarOverlayImages[key]) {
      const image = document.createElement('img');
      image.style.position = 'absolute';
      image.style.objectFit = 'cover';
      image.style.borderRadius = '50%';
      image.style.pointerEvents = 'none';
      image.style.transformOrigin = 'center center';
      image.style.boxSizing = 'border-box';
      image.style.display = 'none';
      image.alt = '';
      this.avatarOverlayDiv.appendChild(image);
      this.avatarOverlayImages[key] = image;
    }

    return this.avatarOverlayImages[key];
  }

  updateAvatarOverlays() {
    if (!this.avatarOverlayDiv && !this.avatarOverlayImages) {
      return;
    }

    if (!this.canvas || !this.div || !this.currentstate || !this.canvas.getBoundingClientRect || !this.div.getBoundingClientRect) {
      this.hideAvatarOverlays({});
      return;
    }

    const canvasRect = this.canvas.getBoundingClientRect();
    const divRect = this.div.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height || !this.canvas.width) {
      this.hideAvatarOverlays({});
      return;
    }

    const activeOverlays = {};
    const scale = canvasRect.width / this.canvas.width;
    for (var num = 0; num < this.currentstate.length; num++) {
      const hand = this.currentstate[num];
      const options = this.getHandDrawOptions(hand);
      if (!this.shouldUseAvatarOverlay(options)) {
        continue;
      }

      const overlay = this.getAvatarOverlay(hand);
      if (!overlay) {
        continue;
      }

      const key = this.slugify(hand.wizardKey);
      activeOverlays[key] = true;
      const size = Math.max(hand.width * 1.4, this.avatarSize) * scale;
      const ringWidth = Math.max(0, this.avatarRingWidth * scale);
      const handDistance = hand.length - (hand.avatarOffset || 0);
      const x = (canvasRect.left - divRect.left) + canvasRect.width / 2 + Math.sin(hand.pos) * handDistance * scale;
      const y = (canvasRect.top - divRect.top) + canvasRect.height / 2 - Math.cos(hand.pos) * handDistance * scale;
      const ringColour = hand.avatarRingColour || hand.textcolour || this.getThemeColour('primaryText');

      if (overlay.dataset.sourceUrl !== hand.avatarUrl) {
        overlay.src = hand.avatarUrl;
        overlay.dataset.sourceUrl = hand.avatarUrl;
      }
      overlay.style.display = 'block';
      overlay.style.left = x + 'px';
      overlay.style.top = y + 'px';
      overlay.style.width = size + 'px';
      overlay.style.height = size + 'px';
      overlay.style.border = ringWidth + 'px solid ' + ringColour;
      overlay.style.opacity = options.alpha === undefined ? '1' : String(options.alpha);
      overlay.style.transform = 'translate(-50%, -50%) rotate(' + (hand.avatarImageUp ? 0 : hand.pos) + 'rad)';
      overlay.style.zIndex = '2';
    }

    this.hideAvatarOverlays(activeOverlays);
  }

  hideAvatarOverlays(activeOverlays) {
    if (!this.avatarOverlayImages) {
      return;
    }

    for (const key in this.avatarOverlayImages) {
      if (!activeOverlays[key]) {
        this.avatarOverlayImages[key].style.display = 'none';
      }
    }
  }

  drawAvatarTip(ctx, length, width, wizard, colour, textcolour, options) {
    if (!options || !options.drawAvatar || options.avatarMode === "none") {
      return;
    }

    const avatarMode = options.avatarMode || "default";
    const useAvatarImage = avatarMode === "avatar" || avatarMode === "image";
    const size = Math.max(width * 1.4, this.avatarSize);
    const x = 0;
    const y = -length + (options.avatarOffset || 0);
    const radius = size / 2;
    const ringWidth = Math.max(0, this.avatarRingWidth);
    const useOverlay = this.shouldUseAvatarOverlay(options);
    const image = useAvatarImage && !useOverlay ? this.getAvatarImage(options.avatarUrl) : undefined;
    const ringColour = options.avatarRingColour || textcolour || this.getThemeColour('primaryText');

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = colour || this.getThemeColour('primary');
    ctx.fill();

    ctx.save();
    if (options.avatarImageUp) {
      ctx.translate(x, y);
      ctx.rotate(-(options.handPos || 0));
      ctx.translate(-x, -y);
    }

    if (useOverlay) {
      // Animated GIFs are rendered by a positioned <img> overlay so the browser can play the loop normally.
    } else if (image && image.complete && !image._wizardClockFailed) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius - ringWidth, 0, 2 * Math.PI);
      ctx.clip();
      ctx.drawImage(image, x - radius + ringWidth, y - radius + ringWidth, size - ringWidth * 2, size - ringWidth * 2);
      ctx.restore();
    } else {
      ctx.font = this.getCanvasFont(size * 0.48);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = textcolour || this.getThemeColour('primaryText');
      ctx.fillText(String(wizard || "?").trim().charAt(0).toUpperCase(), x, y + size * 0.03);
    }
    ctx.restore();

    if (!useOverlay && ringWidth > 0) {
      ctx.beginPath();
      ctx.lineWidth = ringWidth;
      ctx.strokeStyle = ringColour;
      ctx.arc(x, y, radius - ringWidth / 2, 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  configureInitialTestStates() {
    if (!this.testControlsEnabled) {
      return;
    }

    for (var num = 0; num < this.config.wizards.length; num++) {
      const wizard = this.config.wizards[num];
      if (!wizard._test_control && wizard.initial_location === undefined && wizard.initialLocation === undefined && wizard.test_state === undefined && wizard.testState === undefined) {
        continue;
      }

      const key = this.getWizardKey(wizard);
      const initialLocation = wizard.initial_location || wizard.initialLocation || wizard.test_state || wizard.testState || this.getDefaultTestLocation(wizard);
      this.configureInitialRandomZones(key, wizard);
      if (String(initialLocation).toLowerCase() === "random") {
        if (!this.testRandomStates[key]) {
          this.setWizardRandomState(key, wizard, true);
        } else {
          this.ensureTestRandomTimer(key, wizard);
        }
        continue;
      }

      if (this.testStateOverrides[key]) {
        continue;
      }

      if (initialLocation) {
        this.testStateOverrides[key] = initialLocation;
      }
    }
  }

  configureInitialRandomZones(wizardKey, wizard) {
    if (this.testRandomZoneStates[wizardKey] !== undefined) {
      return;
    }

    this.testRandomZoneStates[wizardKey] = this.isRandomZonesEnabled(wizard);
  }

  isRandomZonesEnabled(wizard) {
    return this.getConfigBoolean(
      wizard,
      ["random_zones", "randomZones", "random_plus_zones", "randomPlusZones"],
      this.getConfigBoolean(
        this.testControlsConfig,
        ["random_zones", "randomZones", "random_plus_zones", "randomPlusZones"],
        this.getConfigBoolean(
          this.config,
          ["test_random_zones", "testRandomZones"],
          false
        )
      )
    );
  }

  ensureTestRandomTimers() {
    if (!this.testControlsEnabled || !this.testRandomStates) {
      return;
    }

    const wizards = this.getTestControlWizards();
    for (var num = 0; num < wizards.length; num++) {
      const wizard = wizards[num];
      const wizardKey = this.getWizardKey(wizard);
      this.ensureTestRandomTimer(wizardKey, wizard);
    }
  }

  ensureTestRandomTimer(wizardKey, wizard) {
    if (!this.testRandomStates || !this.testRandomStates[wizardKey]) {
      return;
    }
    if (this.testRandomTimers && this.testRandomTimers[wizardKey]) {
      return;
    }

    this.scheduleRandomTestState(wizardKey, wizard);
  }

  updateTestControls() {
    if (!this.testControlsDiv) {
      return;
    }

    this.clearElement(this.testControlsDiv);
    if (!this.testControlsEnabled) {
      this.testControlsDiv.style.display = 'none';
      return;
    }

    const wizards = this.getTestControlWizards();
    if (!wizards.length) {
      this.testControlsDiv.style.display = 'none';
      return;
    }

    if (this.testControlsCollapsed) {
      this.testControlsDiv.style.display = 'none';
      this.ensureTestRandomTimers();
      return;
    }

    this.testControlsDiv.style.display = 'block';
    this.ensureTestRandomTimers();
    const fragment = document.createDocumentFragment();

    for (var num = 0; num < wizards.length; num++) {
      const wizard = wizards[num];
      const wizardKey = this.getWizardKey(wizard);
      const row = document.createElement('div');
      this.setElementStyles(row, {
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '6px',
        marginTop: num === 0 ? '0' : '8px'
      });

      const name = document.createElement('span');
      name.innerText = wizard.name || wizard.entity || "Wizard";
      this.setElementStyles(name, {
        fontWeight: '700',
        minWidth: '72px'
      });
      row.appendChild(name);

      const locations = this.getTestControlLocations(wizard);
      for (var locNum = 0; locNum < locations.length; locNum++) {
        row.appendChild(this.createTestLocationButton(wizardKey, locations[locNum]));
      }

      row.appendChild(this.createTestRandomButton(wizardKey, wizard));
      if (this.testRandomStates[wizardKey]) {
        row.appendChild(this.createTestRandomZonesButton(wizardKey));
      }
      fragment.appendChild(row);
    }
    this.testControlsDiv.appendChild(fragment);
  }

  createTestLocationButton(wizardKey, location) {
    const obj = this;
    return this.createTestControlButton(location, this.testStateOverrides[wizardKey] === location, function(event) {
      event.preventDefault();
      obj.setWizardTestState(wizardKey, location);
    });
  }

  createTestRandomButton(wizardKey, wizard) {
    const obj = this;
    return this.createTestControlButton('Random', this.testRandomStates[wizardKey], function(event) {
      event.preventDefault();
      obj.setWizardRandomState(wizardKey, wizard);
    });
  }

  createTestRandomZonesButton(wizardKey) {
    const obj = this;
    return this.createTestControlButton('+Zones', this.testRandomZoneStates[wizardKey], function(event) {
      event.preventDefault();
      obj.toggleTestRandomZones(wizardKey);
    });
  }

  setWizardTestState(wizardKey, location) {
    this.stopTestRandomTimer(wizardKey);
    this.testStateOverrides[wizardKey] = location;
    this.updateTestControls();
    this.refreshFromTestControls();
  }

  setWizardRandomState(wizardKey, wizard, skipRefresh) {
    this.testRandomStates[wizardKey] = true;
    this.pickRandomTestState(wizardKey, wizard);
    this.scheduleRandomTestState(wizardKey, wizard);
    this.updateTestControls();
    if (skipRefresh) {
      return;
    }
    this.refreshFromTestControls();
  }

  toggleTestRandomZones(wizardKey) {
    this.testRandomZoneStates[wizardKey] = !this.testRandomZoneStates[wizardKey];
    this.updateTestControls();
    this.refreshFromTestControls();
  }

  pickRandomTestState(wizardKey, wizard) {
    const locations = this.getRandomTestLocations(wizardKey, wizard);
    if (!locations.length) {
      return;
    }

    var nextLocation = locations[Math.floor(Math.random() * locations.length)];
    if (locations.length > 1 && nextLocation === this.testStateOverrides[wizardKey]) {
      nextLocation = locations[(locations.indexOf(nextLocation) + 1 + Math.floor(Math.random() * (locations.length - 1))) % locations.length];
    }
    this.testStateOverrides[wizardKey] = nextLocation;
  }

  scheduleRandomTestState(wizardKey, wizard) {
    this.stopTestRandomTimer(wizardKey, true);
    if (!this.testControlsEnabled || !this.testRandomStates[wizardKey]) {
      return;
    }

    const maxDelay = 5 * 60 * 1000;
    const delay = Math.floor(Math.random() * maxDelay);
    const obj = this;
    this.testRandomTimers[wizardKey] = setTimeout(function() {
      if (!obj.testRandomStates[wizardKey]) {
        return;
      }
      obj.pickRandomTestState(wizardKey, wizard);
      obj.updateTestControls();
      obj.refreshFromTestControls();
      obj.scheduleRandomTestState(wizardKey, wizard);
    }, delay);
  }

  stopTestRandomTimer(wizardKey, keepRandomState) {
    if (this.testRandomTimers && this.testRandomTimers[wizardKey]) {
      clearTimeout(this.testRandomTimers[wizardKey]);
      delete this.testRandomTimers[wizardKey];
    }
    if (!keepRandomState && this.testRandomStates) {
      delete this.testRandomStates[wizardKey];
    }
    if (!keepRandomState && this.testRandomZoneStates) {
      delete this.testRandomZoneStates[wizardKey];
    }
  }

  stopAllTestRandomTimers() {
    if (!this.testRandomTimers) {
      return;
    }

    for (const wizardKey in this.testRandomTimers) {
      clearTimeout(this.testRandomTimers[wizardKey]);
    }
    this.testRandomTimers = {};
    this.testRandomStates = {};
    this.testRandomZoneStates = {};
  }

  disconnectedCallback() {
    this.stopAllTestRandomTimers();
  }

  refreshFromTestControls() {
    if (this._hass) {
      this.hass = this._hass;
    } else if (this.lastframe === 0) {
      const obj = this;
      this.lastframe = requestAnimationFrame(function(){
        obj.drawClock();
      });
    }
  }

  getTestControlWizards() {
    if (!this.testControlsEnabled || !this.config.wizards) {
      return [];
    }

    const testOnlyWizards = this.config.wizards.filter((wizard) => wizard._test_control);
    if (testOnlyWizards.length) {
      return testOnlyWizards;
    }

    return this.config.wizards;
  }

  getTestControlLocations(wizard) {
    const locations = [];
    const wizardLocations = wizard.locations || wizard.test_locations || wizard.testLocations;
    this.addUniqueLocations(locations, this.testControlsConfig ? (this.testControlsConfig.locations || this.testControlsConfig.states) : undefined);
    this.addUniqueLocations(locations, wizardLocations);
    return locations;
  }

  getRandomTestLocations(wizardKey, wizard) {
    const locations = this.getTestControlLocations(wizard);
    if (this.testRandomZoneStates && this.testRandomZoneStates[wizardKey]) {
      this.addUniqueLocations(locations, this.getHaZoneLocations());
    }
    return locations;
  }

  getHaZoneLocations() {
    const zones = [];
    if (!this._hass || !this._hass.states) {
      return zones;
    }

    for (const entityId in this._hass.states) {
      if (entityId.indexOf("zone.") !== 0) {
        continue;
      }

      const state = this._hass.states[entityId];
      const zoneName = state && state.attributes && state.attributes.friendly_name ?
        state.attributes.friendly_name :
        entityId.substring(5).replace(/_/g, " ");
      if (zoneName) {
        zones.push(zoneName);
      }
    }

    return zones;
  }

  getDefaultTestLocation(wizard) {
    const locations = this.getTestControlLocations(wizard);
    return locations.length ? locations[0] : undefined;
  }

  addUniqueLocations(target, locations) {
    if (!locations) {
      return;
    }

    for (var num = 0; num < locations.length; num++) {
      const location = locations[num];
      if (location !== undefined && location !== null && target.indexOf(location) === -1) {
        target.push(location);
      }
    }
  }

  clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  setElementStyles(element, styles) {
    for (const property in styles) {
      element.style[property] = styles[property];
    }
  }

  createTestControlButton(label, active, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerText = label;
    this.setElementStyles(button, {
      border: '1px solid var(--divider-color, #888)',
      borderRadius: '4px',
      padding: '4px 8px',
      background: active ? 'var(--primary-color)' : 'var(--card-background-color, transparent)',
      color: active ? 'var(--text-primary-color, #fff)' : 'var(--primary-text-color)',
      cursor: 'pointer'
    });
    button.addEventListener('click', onClick);
    return button;
  }

  getWizardKey(wizard) {
    return wizard.entity || wizard.name || "";
  }

  slugify(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "wizard";
  }

  updateVersionDebug() {
    if (!this.versionDiv) {
      return;
    }

    if (!this.showVersion) {
      this.versionDiv.style.display = 'none';
      this.versionDiv.innerText = '';
      return;
    }

    this.versionDiv.style.display = 'block';
    this.versionDiv.innerText =
      CARDNAME + " " + VERSION +
      " | font " + this.selectedFont +
      " | loc offset " + this.locationTextOffset +
      " scale " + this.locationTextFontScale +
      " fit " + (this.locationTextAutoFit ? "on" : "off") +
      " | anim " + (this.locationAnimationEnabled ? "on" : "off") +
      " | hand length " + this.handLengthScale;
  }

  configureFont() {
    if (!this.fontstyle) {
      this.fontstyle = document.createElement('style');
      (document.head || document.body).appendChild(this.fontstyle);
    }

    const configuredFontPath = this.config.fontPath || this.config.fontpath || this.config.font_path;
    const fontPath = configuredFontPath || (this.config.fontface ? undefined : DEFAULT_FONT_PATH);
    const fontCacheBuster = this.config.fontCacheBuster || this.config.fontcachebuster || this.config.font_cache_buster || DEFAULT_FONT_CACHE_BUSTER;
    const fontFormat = this.config.fontFormat || this.config.fontformat || this.config.font_format;
    this.fontPath = this.getCacheBustedUrl(fontPath, fontCacheBuster);
    if (this.config.fontface) {
      this.fontstyle.innerText = "@font-face { " + this.config.fontface + " }";
    } else if (fontPath) {
      const fontSource = fontFormat ? "url('" + this.fontPath + "') format('" + fontFormat + "')" : "url('" + this.fontPath + "')";
      this.fontstyle.innerText = "@font-face { font-family: '" + this.selectedFont + "'; src: " + fontSource + "; }";
      if (this.fontFallbackName) {
        this.fontstyle.innerText += " @font-face { font-family: '" + this.fontFallbackName + "'; src: " + fontSource + "; }";
      }
    } else {
      this.fontstyle.innerText = "@font-face { font-family: '" + DEFAULT_FONT_NAME + "'; src: url('" + DEFAULT_FONT_PATH + "'); }";
    }

    this.fontLoadPromise = undefined;
    this.textHeightCache = {};
  }

  loadSelectedFont() {
    if (!document.fonts || !document.fonts.load) {
      return undefined;
    }

    if (!this.fontLoadPromise) {
      if (this.fontPath && window.FontFace) {
        const fontNames = [this.selectedFont];
        if (this.fontFallbackName && this.fontFallbackName !== this.selectedFont) {
          fontNames.push(this.fontFallbackName);
        }
        this.fontLoadPromise = Promise.all(fontNames.map((fontName) => this.loadFontFace(fontName, this.fontPath)))
          .then(() => {
            return document.fonts.ready;
          })
          .then(() => {
            if (document.fonts.check && !this.isFontAvailable()) {
              console.warn(CARDNAME + " font '" + this.selectedFont + "' was requested but is not available. Check font_path and browser cache.");
            }
          })
          .catch((error) => {
            console.warn(CARDNAME + " could not load font '" + this.selectedFont + "' from '" + this.fontPath + "'.", error);
          });
        return this.fontLoadPromise;
      }

      this.fontLoadPromise = document.fonts.load("16px '" + this.selectedFont + "'")
        .then(() => document.fonts.ready)
        .then(() => {
          if (document.fonts.check && !document.fonts.check("16px '" + this.selectedFont + "'")) {
            console.warn(CARDNAME + " font '" + this.selectedFont + "' was requested but is not available. Check font_path and browser cache.");
          }
        })
        .catch((error) => {
          console.warn(CARDNAME + " could not load font '" + this.selectedFont + "'.", error);
        });
    }

    return this.fontLoadPromise;
  }

  loadFontFace(fontName, fontPath) {
    const fontFace = new FontFace(fontName, "url('" + fontPath + "')");
    return fontFace.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
      if (debugLogging || this.config.debug) {
        console.info(CARDNAME + " loaded font '" + fontName + "' from '" + fontPath + "'.");
      }
    });
  }

  isFontAvailable() {
    if (!document.fonts || !document.fonts.check) {
      return false;
    }

    return document.fonts.check("16px '" + this.selectedFont + "'") ||
      (this.fontFallbackName && document.fonts.check("16px '" + this.fontFallbackName + "'"));
  }

  getCanvasFont(size) {
    const fallbackFont = this.fontFallbackName ? ", '" + this.fontFallbackName + "'" : "";
    return size + "px '" + this.selectedFont + "'" + fallbackFont + ", serif";
  }

  getCacheBustedUrl(url, cacheBuster) {
    if (!cacheBuster || url.indexOf("data:") === 0 || url.indexOf("blob:") === 0) {
      return url;
    }

    const separator = url.indexOf("?") === -1 ? "?" : "&";
    return url + separator + "v=" + encodeURIComponent(cacheBuster);
  }

  getLocationKey(location) {
    return String(location).trim();
  }

  isAnimatedLocation(location) {
    return this.getLocationKey(location) !== "";
  }

  setLocationAnimationTargets(locations) {
    const previousLocations = this.locationAnimationTargets || locations;
    const previousSlotCount = previousLocations.length || locations.length || 1;
    this.locationAnimationTargets = locations.slice();
    if (!this.locationAnimationEnabled) {
      this.locationAnimationStates = {};
      this.locationAnimationInitialized = true;
      return;
    }

    const now = this.getAnimationNow();
    if (!this.locationAnimationStates) {
      this.locationAnimationStates = {};
    }

    const targetKeys = {};
    for (var num = 0; num < locations.length; num++) {
      const location = locations[num];
      if (!this.isAnimatedLocation(location)) {
        continue;
      }

      const key = this.getLocationKey(location);
      targetKeys[key] = true;
      if (!this.locationAnimationInitialized) {
        this.locationAnimationStates[key] = {
          label: location,
          index: num,
          status: "visible",
          start: now,
          angle: null,
          targetAngle: null,
          angleStart: now,
          fontScale: null,
          startFontScale: null,
          targetFontScale: null,
          fontScaleStart: now
        };
      } else if (!this.locationAnimationStates[key] || this.locationAnimationStates[key].status === "exiting") {
        this.locationAnimationStates[key] = {
          label: location,
          index: num,
          status: "entering",
          start: now,
          angle: null,
          targetAngle: null,
          angleStart: now,
          fontScale: null,
          startFontScale: null,
          targetFontScale: null,
          fontScaleStart: now
        };
      } else {
        this.locationAnimationStates[key].label = location;
        this.locationAnimationStates[key].index = num;
      }
    }

    if (this.locationAnimationInitialized) {
      for (const key in this.locationAnimationStates) {
        if (!targetKeys[key] && this.locationAnimationStates[key].status !== "exiting") {
          const state = this.locationAnimationStates[key];
          state.angle = state.angle !== null && state.angle !== undefined ? this.getCurrentLocationAngle(state, now) : state.index * Math.PI / previousSlotCount * 2;
          state.exitAngle = state.angle;
          state.exitSlotCount = previousSlotCount;
          state.status = "exiting";
          state.start = now;
        }
      }
    }

    this.locationAnimationInitialized = true;
  }

  getLocationDisplayEntries() {
    const locations = this.locationAnimationTargets || this.zones || [];
    if (!this.locationAnimationEnabled || !this.locationAnimationStates) {
      return locations.map((location) => ({ label: location, slotCount: locations.length || 1 }));
    }

    const now = this.getAnimationNow();
    const entries = [];
    const includedKeys = {};

    for (var num = 0; num < locations.length; num++) {
      const location = locations[num];
      if (!this.isAnimatedLocation(location)) {
        entries.push({ label: location, slotCount: locations.length || 1 });
        continue;
      }

      const key = this.getLocationKey(location);
      const state = this.locationAnimationStates[key];
      if (state) {
        this.updateLocationAnimationState(state, now);
      }
      entries.push({
        label: location,
        animation: state,
        slotCount: locations.length || 1
      });
      includedKeys[key] = true;
    }

    this.updateLocationEntryAngles(entries, now);

    const exitingStates = [];
    for (const key in this.locationAnimationStates) {
      const state = this.locationAnimationStates[key];
      if (state.status === "exiting") {
        this.updateLocationAnimationState(state, now);
        if (state.status === "done") {
          delete this.locationAnimationStates[key];
        } else if (!includedKeys[key]) {
          exitingStates.push(state);
        }
      }
    }

    exitingStates.sort((first, second) => first.index - second.index);
    for (var exitNum = 0; exitNum < exitingStates.length; exitNum++) {
      const state = exitingStates[exitNum];
      entries.push({
        label: state.label,
        animation: state,
        angle: state.exitAngle !== undefined ? state.exitAngle : state.angle,
        slotCount: state.exitSlotCount || locations.length || 1
      });
    }

    return entries;
  }

  updateLocationEntryAngles(entries, now) {
    if (!this.locationAnimationEnabled) {
      return;
    }

    for (var num = 0; num < entries.length; num++) {
      const entry = entries[num];
      const targetAngle = num * Math.PI / entries.length * 2;
      if (!entry.animation) {
        entry.angle = targetAngle;
        continue;
      }

      entry.angle = this.getAnimatedLocationAngle(entry.animation, targetAngle, now);
    }
  }

  getAnimatedLocationAngle(state, targetAngle, now) {
    if (state.targetAngle === null || state.targetAngle === undefined) {
      state.angle = targetAngle;
      state.startAngle = targetAngle;
      state.targetAngle = targetAngle;
      state.angleStart = now;
      return targetAngle;
    }

    if (Math.abs(state.targetAngle - targetAngle) > 0.0001) {
      state.angle = this.getCurrentLocationAngle(state, now);
      state.startAngle = state.angle;
      state.targetAngle = targetAngle;
      state.angleStart = now;
    }

    state.angle = this.getCurrentLocationAngle(state, now);
    return state.angle;
  }

  getCurrentLocationAngle(state, now) {
    const duration = Math.max(1, this.locationAnimationAngleDuration);
    const progress = this.easeOutCubic(this.clamp((now - state.angleStart) / duration, 0, 1));
    return state.startAngle + (state.targetAngle - state.startAngle) * progress;
  }

  getAnimatedLocationFontScale(state, targetFontScale, now) {
    if (!state) {
      return targetFontScale;
    }

    if (state.targetFontScale === null || state.targetFontScale === undefined) {
      state.fontScale = targetFontScale;
      state.startFontScale = targetFontScale;
      state.targetFontScale = targetFontScale;
      state.fontScaleStart = now;
      return targetFontScale;
    }

    if (Math.abs(state.targetFontScale - targetFontScale) > 0.001) {
      state.fontScale = this.getCurrentLocationFontScale(state, now);
      state.startFontScale = state.fontScale;
      state.targetFontScale = targetFontScale;
      state.fontScaleStart = now;
    }

    state.fontScale = this.getCurrentLocationFontScale(state, now);
    return state.fontScale;
  }

  getCurrentLocationFontScale(state, now) {
    const duration = Math.max(1, this.locationAnimationAngleDuration);
    const progress = this.easeOutCubic(this.clamp((now - state.fontScaleStart) / duration, 0, 1));
    return state.startFontScale + (state.targetFontScale - state.startFontScale) * progress;
  }

  updateLocationAnimationState(state, now) {
    if (state.status === "visible" || state.status === "done") {
      return;
    }

    const totalDuration = this.getLocationAnimationTotalDuration(state.label);
    if (now - state.start >= totalDuration) {
      state.status = state.status === "exiting" ? "done" : "visible";
    }
  }

  getLocationAnimationTotalDuration(label) {
    return this.locationAnimationDuration + Math.max(0, String(label).length - 1) * this.locationAnimationLetterStagger;
  }

  getAnimationNow() {
    return typeof window !== "undefined" && window.performance && window.performance.now ? window.performance.now() : Date.now();
  }

  hasActiveLocationAnimations() {
    if (!this.locationAnimationEnabled || !this.locationAnimationStates) {
      return false;
    }

    for (const key in this.locationAnimationStates) {
      const status = this.locationAnimationStates[key].status;
      const moving = this.locationAnimationStates[key].targetAngle !== null &&
        this.locationAnimationStates[key].targetAngle !== undefined &&
        Math.abs(this.locationAnimationStates[key].angle - this.locationAnimationStates[key].targetAngle) > 0.0001;
      const fontMoving = this.locationAnimationStates[key].targetFontScale !== null &&
        this.locationAnimationStates[key].targetFontScale !== undefined &&
        Math.abs(this.locationAnimationStates[key].fontScale - this.locationAnimationStates[key].targetFontScale) > 0.001;
      if (status === "entering" || status === "exiting" || moving || fontMoving) {
        return true;
      }
    }

    return false;
  }

  getLetterAnimationFrame(animation, letterIndex) {
    if (!animation || animation.status === "visible") {
      return { alpha: 1, position: 1 };
    }

    const exitLetterIndex = Math.max(0, String(animation.label).length - 1 - letterIndex);
    const staggerIndex = animation.status === "exiting" ? exitLetterIndex : letterIndex;
    const elapsed = this.getAnimationNow() - animation.start - staggerIndex * this.locationAnimationLetterStagger;
    const rawProgress = this.clamp(elapsed / this.locationAnimationDuration, 0, 1);
    const easedProgress = this.easeOutCubic(rawProgress);

    if (animation.status === "exiting") {
      return {
        alpha: 1 - easedProgress,
        position: 1 - easedProgress
      };
    }

    return {
      alpha: easedProgress,
      position: easedProgress
    };
  }

  easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  getConfigNumber(config, keys, fallback) {
    if (!config) {
      return fallback;
    }

    for (var num = 0; num < keys.length; num++) {
      const value = config[keys[num]];
      if (value !== undefined && value !== null && value !== "") {
        const numberValue = Number(value);
        return Number.isFinite(numberValue) ? numberValue : fallback;
      }
    }

    return fallback;
  }

  getConfigBoolean(config, keys, fallback) {
    if (!config) {
      return fallback;
    }

    for (var num = 0; num < keys.length; num++) {
      const value = config[keys[num]];
      if (value !== undefined && value !== null && value !== "") {
        if (typeof value === "boolean") {
          return value;
        }
        if (typeof value === "string") {
          return value.toLowerCase() === "true";
        }
        return Boolean(value);
      }
    }

    return fallback;
  }

  // getCardSize Indicates the height of the card in 50px units.
  // Home Assistant uses this to automatically distribute all cards over the available columns.
  getCardSize() {
    var cardSize = (this.configuredWidth / 50).toFixed(1);
    if (debugLogging) console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}getCardSize = ${cardSize}`);
    return cardSize;
  }

  getWizardVelocity(state) {
    if (!state || !state.attributes) {
      return 0;
    }

    return state.attributes.velocity ? state.attributes.velocity : (
      state.attributes.speed ? state.attributes.speed : (
        state.attributes.moving ? TRAVELLING_VELOCITY_THRESHOLD + 1 : 0
    ));
  }

  getWizardProximityMovement(wizard) {
    if (!wizard.proximity_sensor || !this._hass.states[wizard.proximity_sensor]) {
      return false;
    }

    return ['towards', 'away_from'].includes(this._hass.states[wizard.proximity_sensor].state);
  }

  getWizardEntity(wizard) {
    return wizard.travel_status_entity ? wizard.travel_status_entity : wizard.entity;
  }

  getWizardMoreInfoEntity(wizard) {
    return wizard.more_info_entity || wizard.moreInfoEntity || wizard.person_entity || wizard.personEntity || wizard.entity;
  }

  getWizardTestState(wizard) {
    if (!this.testControlsEnabled || !this.testStateOverrides) {
      return undefined;
    }

    return this.testStateOverrides[this.getWizardKey(wizard)];
  }

  handleCanvasClick(event) {
    const hand = this.getHandAtEvent(event);
    if (!hand) {
      if (this.handleLocationFilterClick(event)) {
        return;
      }
      this.handleTestUnlockClick(event);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (hand.testControl) {
      this.toggleTestControlsCollapsed();
      return;
    }

    if (!hand.moreInfoEntity) {
      return;
    }

    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: hand.moreInfoEntity },
      bubbles: true,
      composed: true
    }));
  }

  toggleTestControlsCollapsed() {
    this.testControlsCollapsed = !this.testControlsCollapsed;
    this.updateTestControls();
  }

  handleTestUnlockClick(event) {
    if (!this.rawConfig || !this.isTestUnlockEnabled(this.rawConfig) || !this.isTestControlsEnabled(this.rawConfig)) {
      return false;
    }

    const now = this.getAnimationNow();
    this.testUnlockClicks = (this.testUnlockClicks || []).filter((clickTime) => now - clickTime <= 1500);
    this.testUnlockClicks.push(now);
    if (this.testUnlockClicks.length < 5) {
      return false;
    }

    this.testUnlockClicks = [];
    event.preventDefault();
    event.stopPropagation();
    this.toggleTestViewUnlocked();
    return true;
  }

  toggleTestViewUnlocked() {
    const startsHidden = this.isTestViewHidden(this.rawConfig || this.config);
    if (startsHidden) {
      this.testViewUnlocked = !this.testViewUnlocked;
    } else {
      this.testViewForceHidden = !this.testViewForceHidden;
    }

    if ((startsHidden && !this.testViewUnlocked) || (!startsHidden && this.testViewForceHidden)) {
      this.stopAllTestRandomTimers();
      this.testControlsCollapsed = this.getConfigBoolean(
        this.rawConfig || this.config,
        ["test_controls_hidden", "testControlsHidden", "test_controls_collapsed", "testControlsCollapsed"],
        this.testControlsCollapsed
      );
    } else if (!startsHidden) {
      this.testViewUnlocked = false;
    }

    if (this.rawConfig) {
      this.setConfig(this.rawConfig);
      if (this._hass) {
        this.hass = this._hass;
      }
    } else {
      this.updateTestControls();
    }
  }

  getHandAtEvent(event) {
    if (!this.canvas || !this.currentstate || !this.currentstate.length || !this.canvas.getBoundingClientRect) {
      return undefined;
    }

    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return undefined;
    }

    const x = ((event.clientX - rect.left) * this.canvas.width / rect.width) - (this.canvas.width / 2);
    const y = ((event.clientY - rect.top) * this.canvas.height / rect.height) - (this.canvas.height / 2);

    for (var num = this.currentstate.length - 1; num >= 0; num--) {
      const hand = this.currentstate[num];
      if (hand && (hand.moreInfoEntity || hand.testControl) && this.isPointOnHand(x, y, hand)) {
        return hand;
      }
    }

    return undefined;
  }

  handleLocationFilterClick(event) {
    if (!this.locationFilterEnabled || !this.zones || !this.zones.length || !this.canvas || !this.canvas.getBoundingClientRect) {
      return false;
    }

    const location = this.getLocationAtEvent(event);
    if (!location || !this.isAnimatedLocation(location)) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    const sameLocation = this.normalizeLocationName(this.locationFilter) === this.normalizeLocationName(location);
    this.setLocationFilter(sameLocation ? undefined : location);
    this.requestClockRedraw();
    return true;
  }

  getLocationAtEvent(event) {
    const point = this.getCanvasPoint(event);
    if (!point || !this.radius) {
      return undefined;
    }

    const distance = Math.sqrt(point.x * point.x + point.y * point.y);
    if (distance < this.radius * 0.62 || distance > this.radius * 1.12) {
      return undefined;
    }

    var angle = Math.atan2(point.x, -point.y);
    if (angle < 0) {
      angle += Math.PI * 2;
    }

      const displayEntries = this.getLocationDisplayEntries();
    var bestEntry;
    var bestDistance = Number.POSITIVE_INFINITY;
    for (var num = 0; num < displayEntries.length; num++) {
      const entry = displayEntries[num];
      if (!this.isAnimatedLocation(entry.label) || !this.isLocationFilterable(entry.label)) {
        continue;
      }
      const entryAngle = entry.angle !== undefined ? entry.angle : num * Math.PI / displayEntries.length * 2;
      const angleDistance = Math.abs(Math.atan2(Math.sin(angle - entryAngle), Math.cos(angle - entryAngle)));
      if (angleDistance < bestDistance) {
        bestEntry = entry;
        bestDistance = angleDistance;
      }
    }

    const slot = Math.PI * 2 / Math.max(1, displayEntries.length);
    return bestEntry && bestDistance <= slot * 0.45 ? bestEntry.label : undefined;
  }

  getCanvasPoint(event) {
    if (!this.canvas || !this.canvas.getBoundingClientRect) {
      return undefined;
    }

    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return undefined;
    }

    return {
      x: ((event.clientX - rect.left) * this.canvas.width / rect.width) - (this.canvas.width / 2),
      y: ((event.clientY - rect.top) * this.canvas.height / rect.height) - (this.canvas.height / 2)
    };
  }

  isPointOnHand(x, y, hand) {
    const handLength = hand.length || 0;
    const handWidth = hand.width || 0;
    if (!handLength || !handWidth) {
      return false;
    }

    const scaleRatio = this.scaleRatio || 1;
    const cos = Math.cos(-hand.pos);
    const sin = Math.sin(-hand.pos);
    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;
    const hitWidth = Math.max(handWidth * 1.5, 22 * scaleRatio);
    const tipPadding = Math.max(hitWidth, handLength * 0.08);
    const centerPadding = Math.max(hitWidth * 0.5, 8 * scaleRatio);

    if (rotatedY > centerPadding || rotatedY < -handLength - tipPadding) {
      return false;
    }

    const handProgress = this.clamp(Math.abs(rotatedY) / handLength, 0, 1);
    const shapedHitWidth = Math.max(hitWidth, handWidth * (1.6 - handProgress * 0.4));
    return Math.abs(rotatedX) <= shapedHitWidth;
  }

  // get-WizardState makes all decisions about what stateStr should be. (What "number" to point to.)
  getWizardState(wizard) {
    const testState = this.getWizardTestState(wizard);
    if (testState) {
      return testState;
    }

    const entity = this.getWizardEntity(wizard);
    const state = this._hass.states[entity];
    if (!state) {
      console.log(`${this.config.header ? "(" + this.config.header + ") " : ""}Wizard ${entity} does not exist.`);
      return this.lostState;
    }
    const stateVelo = this.getWizardVelocity(state);
    const isMovingByProximity = this.getWizardProximityMovement(wizard);

    /* Prioritize stateStr: 1. message attribute, 2. zone attribute, 3. state */
    var stateStr = "not_home";
    if (state && state.state && state.state !== "off" && state.state !== "unknown") {
        /* Keep the not-so-binary states from person_location integration */
        if (["home", "Home", "Just Arrived", "Just Left"].includes(state.state) && !this.exclude.includes(state.state)) {
          stateStr = state.state;
        } else if (state.attributes) {
            if (state.attributes.message) {
                stateStr = state.attributes.message;
            } else if (state.attributes.zone) {
                stateStr = state.attributes.zone;
            } else {
                stateStr = state.state;
            }
        } else {
            stateStr = state.state;
        }
    }
    /* Skip location if excluded in the config (could be reported below as locality, travelling, or lost */
    if (this.exclude.includes(stateStr)){
      stateStr = 'not_home';
    }
    /* Use friendly name for zones */
    if (this._hass.states["zone." + stateStr] && this._hass.states["zone." + stateStr].attributes && this._hass.states["zone." + stateStr].attributes.friendly_name)
    {
      stateStr = this._hass.states["zone." + stateStr].attributes.friendly_name;
    }
    /* If away and not in a zone, show locality (if locality is geocoded),
    /* otherwise show travelling when movement is detected,
    /* otherwise show lost. */
    if (stateStr.toLowerCase() === 'away' || stateStr === 'not_home') {
      if (stateVelo > TRAVELLING_VELOCITY_THRESHOLD || isMovingByProximity) {
        stateStr = this.travellingState;
      } else {
        stateStr = this.lostState;
      }
      if (state.attributes.locality && !this.exclude.includes(state.attributes.locality)) {
        stateStr = state.attributes.locality
      }
    } else if (stateStr === 'unavailable') {
      stateStr = this.lostState;
    }
    return stateStr;
  }

  drawClock() {
      this.lastframe = 0;
      this.refreshThemeColours();
      this.ensureTestRandomTimers();
      this.updateLocationFilterAutoOff(this.getAnimationNow());

      this.ctx.clearRect(-this.canvas.width / 2, -this.canvas.height / 2, this.canvas.width, this.canvas.height);
      this.drawFace(this.ctx, this.radius);
      this.drawNumbers(this.ctx, this.radius, this.getLocationDisplayEntries());
      this.drawTime(this.ctx, this.radius, this.zones, this.config.wizards);
      this.drawArrivalSparkles(this.ctx);
      this.drawHinge(this.ctx, this.radius, this.shaft_colour);
      // request next frame if required
      var redraw = false;
      var num;
      for (num = 0; num < this.currentstate.length; num++){
        if (Math.round(this.currentstate[num].pos*100) != Math.round(this.targetstate[num].pos*100))
        {
          redraw = true;
        }
      }

      if (redraw || this.hasActiveLocationAnimations() || this.hasActiveVisualEffects()){
        var obj = this;
        this.lastframe = requestAnimationFrame(function(){ 
          obj.drawClock(); 
        });
      }
  }

  drawFace(ctx, radius) {
    ctx.shadowColor = null;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, 2*Math.PI);
      ctx.fillStyle = this.getThemeColour('secondaryBackground');
    ctx.fill();

    ctx.strokeStyle = this.getThemeColour('primaryBackground');
    ctx.lineWidth = radius*0.02;
    ctx.stroke();
  }

  drawHinge(ctx, radius, colour) {
    ctx.beginPath();
    ctx.arc(0, 0, radius*0.05, 0, 2*Math.PI);
    ctx.fillStyle = colour;
    ctx.shadowColor = "#0008";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.fill();
  }

  drawNumbers(ctx, radius, locations) {
      /* 
        Text on a curve code modified from function written by James Alford here: http://blog.graphicsgen.com/2015/03/html5-canvas-rounded-text.html
      */
      var ang;
      var num;
      ctx.textBaseline="middle";
      ctx.textAlign="center";
      ctx.fillStyle = this.getThemeColour('primaryText');
      for(num= 0; num < locations.length; num++){
          const locationEntry = typeof locations[num] === "string" ? { label: locations[num] } : locations[num];
          const locationLabel = String(locationEntry.label);
          ang = locationEntry.angle !== undefined ? locationEntry.angle : num * Math.PI / locations.length * 2;
          // rotate to center of drawing position
          ctx.rotate(ang);

          var startAngle = 0; 
          var inwardFacing = true;
          var kerning = 0; // can adjust kerning using this - maybe automatically adjust it based on text length? 
          // if we're in the bottom half of the clock then reverse the facing of the text so that it's not upside down
          if (ang > Math.PI / 2 && ang < ((Math.PI * 2) - (Math.PI / 2)))
          {
            startAngle = Math.PI;
            inwardFacing = false;
          }

          // calculate height of the font. Many ways to do this - you can replace with your own!
          const baseFontSize = this.locationTextFontSize > 0 ? this.locationTextFontSize : radius*0.15*this.locationTextFontScale;
          const minFontScale = this.locationTextFontSizeMin > 0 ?
            this.clamp(this.locationTextFontSizeMin / baseFontSize, 0, 1) :
            this.locationTextMinFontScale;
          const slotCount = locationEntry.slotCount || locations.length || 1;
          var targetFontScale = 1;
          var fontSize = baseFontSize;
          ctx.font = this.getCanvasFont(fontSize);
          var text = this.getLocationDrawText(locationLabel, inwardFacing);
          var textHeight = this.getCanvasTextHeight(ctx, fontSize);
          const baseTextHeight = textHeight;
          const textArcRadius = radius - baseTextHeight;
          const finalTextY = (inwardFacing ? 1 : -1) * (0 - radius + baseTextHeight - this.locationTextOffset);
          const slotWidth = Math.max(0, (2 * Math.PI * textArcRadius / slotCount) * this.locationTextSlotPadding - this.locationTextSlotGap);
          const lineLabels = this.getLocationTextLines(locationLabel, slotWidth, ctx);

          if (this.locationTextAutoFit && this.isAnimatedLocation(locationLabel)) {
            const maxLineWidth = this.getMaxLocationLineWidth(lineLabels, ctx);
            if (maxLineWidth > slotWidth && slotWidth > 0) {
              targetFontScale = this.clamp(slotWidth / maxLineWidth, minFontScale, 1);
            }
          }

          const animatedFontScale = this.getAnimatedLocationFontScale(locationEntry.animation, targetFontScale, this.getAnimationNow());
          fontSize = baseFontSize * animatedFontScale;
          ctx.font = this.getCanvasFont(fontSize);
          textHeight = this.getCanvasTextHeight(ctx, fontSize);

          const lineStep = textHeight * this.locationTextLineSpacing + this.locationTextLineGap;
          var letterIndex = 0;
          for (var lineNum = 0; lineNum < lineLabels.length; lineNum++) {
            const lineOffset = finalTextY < 0 ?
              lineNum * lineStep :
              (lineNum - (lineLabels.length - 1)) * lineStep;
            const lineText = this.getLocationDrawText(lineLabels[lineNum], inwardFacing);
            this.drawCurvedLocationLine(ctx, lineText, textArcRadius, startAngle, finalTextY + lineOffset, locationEntry.animation, letterIndex, kerning);
            letterIndex += lineText.length;
          }

          // rotate to the next location
          ctx.rotate(-ang);
      }
  }

  drawCurvedLocationLine(ctx, text, textArcRadius, startAngle, y, animation, letterStartIndex, kerning) {
      var lineStartAngle = startAngle;

      // rotate 50% of total angle for center alignment
      for (var j = 0; j < text.length; j++) {
          var charWid = ctx.measureText(text[j]).width;
          lineStartAngle += ((charWid + (j == text.length-1 ? 0 : kerning)) / textArcRadius) / 2 ;
      }

      // Phew... now rotate into final start position
      ctx.rotate(lineStartAngle);

      // Now for the fun bit: draw, rotate, and repeat
      for (var drawNum = 0; drawNum < text.length; drawNum++) {
          var drawCharWidth = ctx.measureText(text[drawNum]).width; // half letter
          const letterAnimation = this.getLetterAnimationFrame(animation, letterStartIndex + drawNum);
          // rotate half letter
          ctx.rotate((drawCharWidth/2) / textArcRadius * -1);
          // draw the character at "top" or "bottom"
          // depending on inward or outward facing
          const originalAlpha = ctx.globalAlpha;
          ctx.globalAlpha = originalAlpha * letterAnimation.alpha;
          ctx.fillText(text[drawNum], 0, y * letterAnimation.position);
          ctx.globalAlpha = originalAlpha;

          ctx.rotate((drawCharWidth/2 + kerning) / textArcRadius * -1); // rotate half letter
      }
      // rotate back round from the end position to the central position of the text
      ctx.rotate(lineStartAngle);
  }

  getLocationDrawText(label, inwardFacing) {
    var text = inwardFacing ? String(label).split("").reverse().join("") : String(label);
    return this.isRtlLanguage(text) ? text.split("").reverse().join("") : text;
  }

  getLocationTextLines(label, slotWidth, ctx) {
    const explicitLines = String(label).split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
    const sourceLines = explicitLines.length ? explicitLines : [String(label)];
    if (!this.locationTextWrap || this.locationTextMaxLines <= 1 || slotWidth <= 0) {
      return sourceLines.slice(0, Math.max(1, this.locationTextMaxLines));
    }

    const lines = [];
    for (var num = 0; num < sourceLines.length; num++) {
      const line = sourceLines[num];
      if (lines.length >= this.locationTextMaxLines) {
        lines[lines.length - 1] += " " + line;
        continue;
      }

      const wrapped = this.wrapLocationTextLine(line, slotWidth, ctx, this.locationTextMaxLines - lines.length);
      for (var wrapNum = 0; wrapNum < wrapped.length; wrapNum++) {
        lines.push(wrapped[wrapNum]);
      }
    }

    return lines.length ? lines : [String(label)];
  }

  wrapLocationTextLine(label, slotWidth, ctx, remainingLines) {
    const words = String(label).trim().split(/\s+/).filter((word) => word !== "");
    if (words.length <= 1 || remainingLines <= 1 || this.getLocationTextWidth(label, ctx) <= slotWidth) {
      return [String(label)];
    }

    var bestLines = [String(label)];
    var bestWidth = Number.POSITIVE_INFINITY;
    for (var splitNum = 1; splitNum < words.length; splitNum++) {
      const firstLine = words.slice(0, splitNum).join(" ");
      const secondLine = words.slice(splitNum).join(" ");
      const candidateWidth = Math.max(this.getLocationTextWidth(firstLine, ctx), this.getLocationTextWidth(secondLine, ctx));
      if (candidateWidth < bestWidth) {
        bestLines = [firstLine, secondLine];
        bestWidth = candidateWidth;
      }
    }

    return bestLines.slice(0, remainingLines);
  }

  getMaxLocationLineWidth(lines, ctx) {
    var maxWidth = 0;
    for (var num = 0; num < lines.length; num++) {
      maxWidth = Math.max(maxWidth, this.getLocationTextWidth(lines[num], ctx));
    }
    return maxWidth;
  }

  getLocationTextWidth(text, ctx) {
    var textWidth = 0;
    const drawText = String(text);
    for (var num = 0; num < drawText.length; num++) {
      textWidth += ctx.measureText(drawText[num]).width;
    }
    return textWidth;
  }

  getCanvasTextHeight(ctx, fontSize) {
    if (!this.textHeightCache) {
      this.textHeightCache = {};
    }

    const cacheKey = this.selectedFont + "|" + Math.round(fontSize * 100) / 100;
    if (this.textHeightCache[cacheKey]) {
      return this.textHeightCache[cacheKey];
    }

    const metrics = ctx.measureText("Mg");
    const measuredHeight = metrics.actualBoundingBoxAscent !== undefined && metrics.actualBoundingBoxDescent !== undefined ?
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent :
      fontSize;
    const textHeight = Math.max(fontSize * 0.75, measuredHeight || fontSize);
    this.textHeightCache[cacheKey] = textHeight;
    return textHeight;
  }

  isRtlLanguage(text) {
    const rtlChar = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    return rtlChar.test(text);
  }

  drawTime(ctx, radius, locations, wizards){
      this.targetstate = [];
      var num;
      var handLocations = [];
      var wizardLocationNames = [];
      var locationCounts = {};
      this.locationHandCounts = {};

      for (num = 0; num < wizards.length; num++){
        const stateStr = this.getWizardState(wizards[num]);
        var locnum;
        var locationIndex = 0;
        for (locnum = 0; locnum < locations.length; locnum++){
          if (locations[locnum].toLowerCase() == stateStr.toLowerCase())
          {
            locationIndex = locnum;
            break;
          }
        }
        handLocations.push(locationIndex);
        wizardLocationNames.push(stateStr);
        locationCounts[locationIndex] = (locationCounts[locationIndex] || 0) + 1;
        const locationCountKey = this.normalizeLocationName(stateStr);
        this.locationHandCounts[locationCountKey] = (this.locationHandCounts[locationCountKey] || 0) + 1;
      }

      if (this.locationFilter && !this.isLocationFilterable(this.locationFilter)) {
        this.clearLocationFilter();
      }

      var locationIndexes = {};
      for (num = 0; num < wizards.length; num++){
        var groupLocation = handLocations[num];
        var groupSize = locationCounts[groupLocation];
        var groupIndex = locationIndexes[groupLocation] || 0;
        locationIndexes[groupLocation] = groupIndex + 1;

        var wizardOffset = 0;
        if (groupSize > 1) {
          const spread = this.locationFilterEnabled && this.locationFilter && this.normalizeLocationName(wizardLocationNames[num]) === this.normalizeLocationName(this.locationFilter) ?
            this.locationFilterSpread :
            this.handLocationSpread;
          wizardOffset = ((groupIndex - ((groupSize - 1) / 2)) / groupSize * spread);
        }
        var location = groupLocation + wizardOffset;
        //var location = locations.indexOf(wizards[num].location) + ((num-((wizards.length-1)/2)) / wizards.length * 0.75);
        location = location * Math.PI / locations.length * 2;
        this.recordWizardMovement(wizards[num], wizardLocationNames[num], location, radius*this.handLengthScale);
        // set targetstate
        this.targetstate.push({
          pos: location,
          length: radius*this.handLengthScale,
          width: radius*this.handWidthScale,
          wizard: wizards[num].name,
          colour: wizards[num].colour,
          textcolour: wizards[num].textcolour,
          moreInfoEntity: this.getWizardMoreInfoEntity(wizards[num]),
          testControl: Boolean(wizards[num]._test_control),
          wizardKey: this.getWizardKey(wizards[num]),
          locationName: wizardLocationNames[num],
          handText: this.getWizardHandText(wizards[num]),
          handTextOffset: this.getWizardHandTextOffset(wizards[num]),
          handTextXOffset: this.getWizardHandTextXOffset(wizards[num]),
          handTextFontScale: this.getWizardHandTextFontScale(wizards[num]),
          handTextFontSize: this.getWizardHandTextFontSize(wizards[num]),
          avatarMode: this.getWizardAvatarMode(wizards[num]),
          avatarUrl: this.getWizardAvatarUrl(wizards[num]),
          avatarOffset: this.getWizardAvatarOffset(wizards[num]),
          avatarShowName: this.getWizardAvatarShowName(wizards[num]),
          avatarRingColour: this.getWizardAvatarRingColour(wizards[num]),
          avatarImageUp: this.getWizardAvatarImageUp(wizards[num])
        });
      }
      // update currentstate from targetstate
      if (!this.currentstate)
      {
        this.currentstate = [];
      }
      for (num = 0; num < wizards.length; num++){
        if (this.currentstate[num]){
          const previousPos = this.currentstate[num].pos;
          const targetPos = this.targetstate[num].pos;
          const targetDistance = this.getAngleDistance(previousPos, targetPos);
          this.currentstate[num].moving = targetDistance > 0.004;
          this.currentstate[num].pos = previousPos + ((targetPos - previousPos) / 60);
          this.currentstate[num].length = this.targetstate[num].length;
          this.currentstate[num].width = this.targetstate[num].width;
          this.currentstate[num].wizard = this.targetstate[num].wizard;
          this.currentstate[num].colour = this.targetstate[num].colour;
          this.currentstate[num].textcolour = this.targetstate[num].textcolour;
          this.currentstate[num].moreInfoEntity = this.targetstate[num].moreInfoEntity;
          this.currentstate[num].testControl = this.targetstate[num].testControl;
          this.currentstate[num].wizardKey = this.targetstate[num].wizardKey;
          this.currentstate[num].locationName = this.targetstate[num].locationName;
          this.currentstate[num].handText = this.targetstate[num].handText;
          this.currentstate[num].handTextOffset = this.targetstate[num].handTextOffset;
          this.currentstate[num].handTextXOffset = this.targetstate[num].handTextXOffset;
          this.currentstate[num].handTextFontScale = this.targetstate[num].handTextFontScale;
          this.currentstate[num].handTextFontSize = this.targetstate[num].handTextFontSize;
          this.currentstate[num].avatarMode = this.targetstate[num].avatarMode;
          this.currentstate[num].avatarUrl = this.targetstate[num].avatarUrl;
          this.currentstate[num].avatarOffset = this.targetstate[num].avatarOffset;
          this.currentstate[num].avatarShowName = this.targetstate[num].avatarShowName;
          this.currentstate[num].avatarRingColour = this.targetstate[num].avatarRingColour;
          this.currentstate[num].avatarImageUp = this.targetstate[num].avatarImageUp;
        } else {
          // default to 12 o'clock to start
          this.currentstate.push({
            pos: 0,
            length: this.targetstate[num].length,
            width: this.targetstate[num].width,
            wizard: this.targetstate[num].wizard,
            colour: this.targetstate[num].colour,
            textcolour: this.targetstate[num].textcolour,
            moreInfoEntity: this.targetstate[num].moreInfoEntity,
            testControl: this.targetstate[num].testControl,
            wizardKey: this.targetstate[num].wizardKey,
            locationName: this.targetstate[num].locationName,
            handText: this.targetstate[num].handText,
            handTextOffset: this.targetstate[num].handTextOffset,
            handTextXOffset: this.targetstate[num].handTextXOffset,
            handTextFontScale: this.targetstate[num].handTextFontScale,
            handTextFontSize: this.targetstate[num].handTextFontSize,
            avatarMode: this.targetstate[num].avatarMode,
            avatarUrl: this.targetstate[num].avatarUrl,
            avatarOffset: this.targetstate[num].avatarOffset,
            avatarShowName: this.targetstate[num].avatarShowName,
            avatarRingColour: this.targetstate[num].avatarRingColour,
            avatarImageUp: this.targetstate[num].avatarImageUp,
            moving: false
          });
        }
      }
      this.currentstate.length = wizards.length;
      // draw currentstate
      for (num = 0; num < wizards.length; num++){
        this.drawHandTrail(ctx, this.currentstate[num]);
      }
      for (num = 0; num < wizards.length; num++){
        this.drawHand(ctx, this.currentstate[num].pos, this.currentstate[num].length, this.currentstate[num].width, this.currentstate[num].wizard, this.currentstate[num].colour, this.currentstate[num].textcolour, this.getHandDrawOptions(this.currentstate[num]));
        this.updateHandTrail(this.currentstate[num]);
      }
      this.updateAvatarOverlays();
  }

  drawHand(ctx, pos, length, width, wizard, colour, textcolour, options) {
    options = options || {};
    const originalAlpha = ctx.globalAlpha === undefined ? 1 : ctx.globalAlpha;
    const originalShadowColor = ctx.shadowColor;
    const originalShadowBlur = ctx.shadowBlur;
    const originalShadowOffsetX = ctx.shadowOffsetX;
    const originalShadowOffsetY = ctx.shadowOffsetY;
    ctx.globalAlpha = originalAlpha * (options.alpha === undefined ? 1 : options.alpha);
    ctx.beginPath();
    ctx.lineWidth = width;
    if (colour) {
      ctx.fillStyle = colour;
    } else {
        ctx.fillStyle = this.getThemeColour('primary');
    }
    const shadowEnabled = options.shadow !== false;
    ctx.shadowColor = options.glowAlpha ? this.colorWithAlpha(colour || ctx.fillStyle, 0.25 + options.glowAlpha * 0.55) : "#0008";
    ctx.shadowBlur = options.glowAlpha ? this.recentMovementGlowBlur : (shadowEnabled ? 10 : 0);
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    ctx.moveTo(0,0);
    ctx.rotate(pos);
    ctx.quadraticCurveTo(width, -length*0.5, width, -length*0.75);
    ctx.quadraticCurveTo(width*0.2, -length*0.8, 0, -length);
    ctx.quadraticCurveTo(-width*0.2, -length*0.8, -width, -length*0.75);
    ctx.quadraticCurveTo(-width, -length*0.5, 0, 0);

    ctx.fill();
    this.drawAvatarTip(ctx, length, width, wizard, colour, textcolour, options);

    if (options.drawText !== false) {
      ctx.shadowColor = "#0000";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      const handText = options.handText !== undefined && options.handText !== null ? options.handText : wizard;
      const handTextFontSize = options.handTextFontSize && options.handTextFontSize > 0 ?
        options.handTextFontSize :
        width * (options.handTextFontScale || this.handTextFontScale);
      const handTextOffset = options.handTextOffset === undefined ? this.handTextOffset : options.handTextOffset;
      const handTextXOffset = options.handTextXOffset === undefined ? this.handTextXOffset : options.handTextXOffset;
      ctx.font = this.getCanvasFont(handTextFontSize);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (textcolour) {
        ctx.fillStyle = textcolour;
      } else {
        ctx.fillStyle = this.getThemeColour('primaryText');
      }
      ctx.translate(0, -length/2 - handTextOffset);
      ctx.rotate(Math.PI/2)
      if (pos < Math.PI && pos >= 0)
          ctx.rotate(Math.PI);
      ctx.translate(0, handTextXOffset);
      ctx.fillText(handText, 0, 0);
      ctx.translate(0, -handTextXOffset);
      if (pos < Math.PI && pos >= 0)
          ctx.rotate(-Math.PI);
      ctx.rotate(-Math.PI/2);
      ctx.translate(0, length/2 + handTextOffset);
    }
    
    ctx.rotate(-pos);
    ctx.globalAlpha = originalAlpha;
    ctx.shadowColor = originalShadowColor;
    ctx.shadowBlur = originalShadowBlur;
    ctx.shadowOffsetX = originalShadowOffsetX;
    ctx.shadowOffsetY = originalShadowOffsetY;
  }

}

/* debounce the reaction to a card resize */
let resizeTimeout = false;
let resizeDelay = 500;

function debouncedOnResize(thisObject) {
  if (debugLogging) console.log(`${thisObject.config && thisObject.config.header ? "(" + thisObject.config.header + ") " : ""}debouncedOnResize triggering set hass`);
  /* trigger an update */
  thisObject.hass = thisObject._hass;
}

function createResizeObserver(thisObject) {
  return new ResizeObserver((entries) => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => debouncedOnResize(thisObject), resizeDelay);  });
}

customElements.define(CARDNAME, WizardClockCard);
