// Approximates black-body RGB from correlated color temperature (Tanner
// Helland's widely used curve fit: https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html),
// for the sun rig's warm sunrise/sunset → neutral daylight color shift.

function clamp255(x: number): number {
  return Math.min(255, Math.max(0, x));
}

/** RGB (each 0-1) for a correlated color temperature in kelvin. */
export function kelvinToRgb01(kelvin: number): readonly [number, number, number] {
  const temp = kelvin / 100;

  const red = temp <= 66 ? 255 : clamp255(329.698727446 * (temp - 60) ** -0.1332047592);

  const green =
    temp <= 66
      ? clamp255(99.4708025861 * Math.log(temp) - 161.1195681661)
      : clamp255(288.1221695283 * (temp - 60) ** -0.0755148492);

  const blue =
    temp >= 66
      ? 255
      : temp <= 19
        ? 0
        : clamp255(138.5177312231 * Math.log(temp - 10) - 305.0447927307);

  return [red / 255, green / 255, blue / 255];
}
