/**
 * Port labels for HTML crew-list forms — "City, Country  /  City, Country".
 */
(function (global) {
  function formatPortWithCountry(portName, ports) {
    if (!portName) return '';
    const portsList = Array.isArray(ports) ? ports : [];
    const found = portsList.find(
      (p) => p.name && p.name.toLowerCase() === String(portName).toLowerCase(),
    );
    return found && found.country ? `${portName}, ${found.country}` : portName;
  }

  function formatPortsFromTo(lastPort, nextPort, ports) {
    return [formatPortWithCountry(lastPort, ports), formatPortWithCountry(nextPort, ports)]
      .filter(Boolean)
      .join('  /  ');
  }

  global.CrewPortFormat = { formatPortWithCountry, formatPortsFromTo };
})(typeof window !== 'undefined' ? window : globalThis);
