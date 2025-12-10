import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function Barcode({ value, options = {} }) {
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      // Clear previous barcode
      barcodeRef.current.innerHTML = '';
      
      // Generate barcode
      try {
        JsBarcode(barcodeRef.current, value, {
          format: 'CODE128', // Common barcode format
          width: 2,
          height: 60,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
          ...options, // Allow custom options
          displayValue: false, // Always hide the code below barcode (override any option)
        });
      } catch (error) {
        console.error('Error generating barcode:', error);
      }
    }
  }, [value, options]);

  if (!value) {
    return null;
  }

  return (
    <div className="flex flex-col items-center">
      <svg ref={barcodeRef} className="w-full" />
    </div>
  );
}

