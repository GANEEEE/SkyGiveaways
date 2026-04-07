// Bot/System/durationParser.js

/**
 * تحويل المدة النصية إلى ميلي ثانية مع دعم القيم المتعددة
 * @param {string} input - المدة المدخلة (مثال: 10m, 2h 30m, 1w 2d 3h 4m 5s)
 * @returns {number|null} - المدة بالميلي ثانية أو null إذا كانت غير صالحة
 * @example
 * parseDuration('10m') // returns 600000
 * parseDuration('2h 30m') // returns 9000000
 * parseDuration('1w 2d 3h 4m 5s') // returns 788645000
 */
function parseDuration(input) {
  if (!input || typeof input !== 'string') {
    console.warn('⚠️ [DurationParser] Invalid input type');
    return null;
  }

  const str = input.trim().toLowerCase();

  // إذا كانت المدة قيمة واحدة فقط (للتوافق مع الإصدار القديم)
  const singleMatch = str.match(/^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hour|hours|d|day|days|w|week|weeks)?$/i);

  if (singleMatch && !str.includes(' ')) {
    return parseSingleDuration(singleMatch, str);
  }

  // إذا كانت المدة مكونة من قيم متعددة
  return parseMultipleDurations(str);
}

/**
 * تحويل مدة واحدة إلى ميلي ثانية
 */
function parseSingleDuration(match, originalInput) {
  const value = parseInt(match[1]);
  const unit = match[2] || 'm'; // Default to minutes if no unit provided

  const multipliers = {
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
    h: 3600000, hour: 3600000, hours: 3600000,
    d: 86400000, day: 86400000, days: 86400000,
    w: 604800000, week: 604800000, weeks: 604800000,
  };

  if (!multipliers[unit]) {
    console.warn(`⚠️ [DurationParser] Unknown time unit: ${unit}`);
    return null;
  }

  const duration = value * multipliers[unit];

  // تحقق من أن القيمة ليست Infinity أو NaN
  if (!Number.isFinite(duration)) {
    console.warn(`⚠️ [DurationParser] Invalid duration calculation for: ${originalInput}`);
    return null;
  }

  console.log(`✅ [DurationParser] Parsed ${originalInput} -> ${duration}ms`);
  return duration;
}

/**
 * تحويل مدد متعددة إلى ميلي ثانية
 */
function parseMultipleDurations(input) {
  // نمط للعثور على جميع القيم والوحدات في النص
  const pattern = /(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hour|hours|d|day|days|w|week|weeks)/gi;

  const matches = [];
  let match;
  let totalDuration = 0;

  // العثور على جميع المطابقات
  while ((match = pattern.exec(input)) !== null) {
    matches.push({
      value: parseInt(match[1]),
      unit: match[2].toLowerCase(),
      original: match[0]
    });
  }

  // إذا لم يتم العثور على أي مدة صالحة
  if (matches.length === 0) {
    console.warn(`⚠️ [DurationParser] No valid durations found in: ${input}`);
    return null;
  }

  const multipliers = {
    s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
    m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
    h: 3600000, hour: 3600000, hours: 3600000,
    d: 86400000, day: 86400000, days: 86400000,
    w: 604800000, week: 604800000, weeks: 604800000,
  };

  // حساب المدة الإجمالية
  for (const item of matches) {
    const multiplier = multipliers[item.unit];
    if (!multiplier) {
      console.warn(`⚠️ [DurationParser] Unknown time unit: ${item.unit} in: ${item.original}`);
      return null;
    }

    const duration = item.value * multiplier;

    if (!Number.isFinite(duration)) {
      console.warn(`⚠️ [DurationParser] Invalid duration calculation for: ${item.original}`);
      return null;
    }

    totalDuration += duration;
  }

  // التحقق من أن المدة الإجمالية صالحة
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    console.warn(`⚠️ [DurationParser] Invalid total duration calculation for: ${input}`);
    return null;
  }

  console.log(`✅ [DurationParser] Parsed "${input}" -> ${totalDuration}ms (${matches.length} components)`);
  return totalDuration;
}

/**
 * تحويل المدة بالميلي ثانية إلى تنسيق مقروء بالكامل
 * @param {number} ms - المدة بالميلي ثانية
 * @returns {string} - المدة بصيغة مقروءة بالكامل
 * @example
 * formatDuration(788645000) // returns "1 week 2 days 3 hours 4 minutes 5 seconds"
 */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return '0 seconds';
  }

  const units = [
    { label: 'week', value: 604800000, plural: 'weeks' },
    { label: 'day', value: 86400000, plural: 'days' },
    { label: 'hour', value: 3600000, plural: 'hours' },
    { label: 'minute', value: 60000, plural: 'minutes' },
    { label: 'second', value: 1000, plural: 'seconds' }
  ];

  let remaining = ms;
  const parts = [];

  for (const unit of units) {
    const count = Math.floor(remaining / unit.value);
    if (count > 0) {
      const label = count === 1 ? unit.label : unit.plural;
      parts.push(`${count} ${label}`);
      remaining %= unit.value;
    }
  }

  // إذا كانت المدة أقل من ثانية، عرضها بالثواني
  if (parts.length === 0) {
    return '0 seconds';
  }

  return parts.join(' ');
}

module.exports = parseDuration;
module.exports.formatDuration = formatDuration;