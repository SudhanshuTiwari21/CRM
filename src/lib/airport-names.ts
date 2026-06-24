/** Common Indian airport full names for e-ticket display. */
const AIRPORT_NAMES: Record<string, { name: string; city: string }> = {
  DXB: { city: "Dubai", name: "Dubai Intl. Airport" },
  CCU: { city: "Kolkata", name: "Netaji Subhash Chandra Bose International Airport" },
  DEL: { city: "New Delhi", name: "Indira Gandhi International Airport" },
  BOM: { city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International Airport" },
  BLR: { city: "Bengaluru", name: "Kempegowda International Airport" },
  MAA: { city: "Chennai", name: "Chennai International Airport" },
  HYD: { city: "Hyderabad", name: "Rajiv Gandhi International Airport" },
  GAU: { city: "Guwahati", name: "Lokpriya Gopinath Bordoloi International Airport" },
  GWA: { city: "Gwalior", name: "Rajmata Vijaya Raje Scindia Airport" },
  BHO: { city: "Bhopal", name: "Raja Bhoj Airport" },
  PNQ: { city: "Pune", name: "Pune Airport" },
  GOI: { city: "Goa", name: "Manohar International Airport" },
  COK: { city: "Kochi", name: "Cochin International Airport" },
  TRV: { city: "Thiruvananthapuram", name: "Trivandrum International Airport" },
  AMD: { city: "Ahmedabad", name: "Sardar Vallabhbhai Patel International Airport" },
  JAI: { city: "Jaipur", name: "Jaipur International Airport" },
  LKO: { city: "Lucknow", name: "Chaudhary Charan Singh International Airport" },
  PAT: { city: "Patna", name: "Jay Prakash Narayan International Airport" },
  IXR: { city: "Ranchi", name: "Birsa Munda Airport" },
  BBI: { city: "Bhubaneswar", name: "Biju Patnaik International Airport" },
  SXR: { city: "Srinagar", name: "Sheikh ul-Alam International Airport" },
  IXC: { city: "Chandigarh", name: "Chandigarh International Airport" },
  ATQ: { city: "Amritsar", name: "Sri Guru Ram Dass Jee International Airport" },
  VNS: { city: "Varanasi", name: "Lal Bahadur Shastri International Airport" },
  IXB: { city: "Bagdogra", name: "Bagdogra Airport" },
  DIB: { city: "Dibrugarh", name: "Dibrugarh Airport" },
  IXL: { city: "Leh", name: "Kushok Bakula Rimpochee Airport" },
};

export function getAirportDisplay(code: string, fallbackCity?: string) {
  const c = code.toUpperCase().trim();
  const entry = AIRPORT_NAMES[c];
  if (entry) {
    return { city: entry.city, airportLine: `${c} - ${entry.name}` };
  }
  return {
    city: fallbackCity || c,
    airportLine: `${c} - ${fallbackCity || c} Airport`,
  };
}
