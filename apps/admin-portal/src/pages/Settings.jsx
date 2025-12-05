import { useState } from 'react';
import Layout from '../components/Layout';

export default function Settings() {
  const [brandColors, setBrandColors] = useState({
    primaryOrange: '#f66633',
    brown: '#4b2e2b',
    cream: '#f5e9da',
    dark: '#333333',
    teal: '#3a878c',
  });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  const handleColorChange = (key, value) => {
    setBrandColors({ ...brandColors, [key]: value });
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    // TODO: Implement API call to save settings
    alert('Settings saved successfully! (Note: API integration needed)');
  };

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Brand Colors */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Brand Colors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Orange</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandColors.primaryOrange}
                  onChange={(e) => handleColorChange('primaryOrange', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={brandColors.primaryOrange}
                  onChange={(e) => handleColorChange('primaryOrange', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Brown</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandColors.brown}
                  onChange={(e) => handleColorChange('brown', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={brandColors.brown}
                  onChange={(e) => handleColorChange('brown', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cream</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandColors.cream}
                  onChange={(e) => handleColorChange('cream', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={brandColors.cream}
                  onChange={(e) => handleColorChange('cream', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dark</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandColors.dark}
                  onChange={(e) => handleColorChange('dark', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={brandColors.dark}
                  onChange={(e) => handleColorChange('dark', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Teal</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandColors.teal}
                  onChange={(e) => handleColorChange('teal', e.target.value)}
                  className="h-10 w-20 border border-gray-300 rounded"
                />
                <input
                  type="text"
                  value={brandColors.teal}
                  onChange={(e) => handleColorChange('teal', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Color Preview */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold mb-3">Color Preview</h3>
            <div className="flex gap-2">
              {Object.entries(brandColors).map(([key, color]) => (
                <div key={key} className="flex flex-col items-center">
                  <div
                    className="w-16 h-16 rounded-lg shadow"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-600 mt-1 capitalize">{key}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Logo Upload */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Logo</h2>
          <div className="flex gap-6 items-start">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-espro-orange file:text-white hover:file:bg-orange-600"
              />
              <p className="text-xs text-gray-500 mt-2">Recommended: PNG with transparent background</p>
            </div>
            {(logoPreview || logo) && (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center p-4">
                <img
                  src={logoPreview || '/logo.png'}
                  alt="Logo preview"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-espro-orange text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600"
          >
            Save Settings
          </button>
        </div>
      </div>
    </Layout>
  );
}

