/** Standard terms page for flight vouchers (Wingie-style layout). */
export function getVoucherTermsContent(companyName: string) {
  return {
    title: `${companyName} Terms of Use`,
    intro:
      "Below are the flight and cancellation/refund related terms in our Terms and Conditions:",
    sections: [
      {
        heading: "5. Rebooking, Cancellation, Termination, Unrealized Travel, Refund",
        items: [
          {
            label: "(a)",
            text: "Cancellation and change rules depend on the airline fare conditions. We recommend travel insurance for unforeseen changes.",
          },
          {
            label: "(b)",
            text: "We are not liable for schedule changes, technical failures, weather, strikes, or other force majeure events imposed by airlines or authorities.",
          },
          {
            label: "(c) Refunding (repayment)",
            text: "Approved refunds are processed to the original payment method. Service fees and payment gateway charges may be non-refundable as per airline and agency policy.",
          },
        ],
      },
      {
        heading: "6. Special Conditions of the Airway Companies and Travel Information",
        paragraphs: [
          "The conditions of carriage and travel information of the respective airline apply to your flight booking. These may include restrictions on rebooking, cancellation, baggage, and check-in. We are not liable for inaccuracies in information provided by third parties.",
        ],
        items: [
          {
            label: "(a) Limitations on Prices",
            text: "Promotional fares may be non-transferable and non-refundable. Please verify fare rules before travel.",
          },
          {
            label: "(b) Additional Services",
            text: "Extra baggage, seat selection, meals, and other add-ons may incur additional charges payable to the airline or at the airport.",
          },
          {
            label: "(c) Baggage",
            text: "Baggage allowances vary by airline and fare class. The passenger is responsible for baggage at check-in. We are not liable for loss or damage handled by the airline.",
          },
        ],
      },
    ],
    closing: `Thank you for choosing ${companyName}!`,
  };
}
