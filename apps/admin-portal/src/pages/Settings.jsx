import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAPI } from '../services/api';
import Layout from '../components/Layout';
import { getBaseApiUrl } from '../utils/api';

export default function Settings() {
  const queryClient = useQueryClient();
  const [brandColors, setBrandColors] = useState({
    primaryOrange: '#f66633',
    brown: '#4b2e2b',
    cream: '#f5e9da',
    dark: '#333333',
    teal: '#3a878c',
  });
  const [odooSyncEnabled, setOdooSyncEnabled] = useState(true);
  const [odooCustomerSyncEnabled, setOdooCustomerSyncEnabled] = useState(true);
  const [odooVoucherSyncEnabled, setOdooVoucherSyncEnabled] = useState(true);
  const [odooBalanceUpdateEnabled, setOdooBalanceUpdateEnabled] = useState(true);
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);

  // Fetch settings
  const { data: settingsResponse, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => adminAPI.getSettings().then((res) => res.data.settings),
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settingsResponse) {
      if (settingsResponse.brandColors) {
        setBrandColors(settingsResponse.brandColors);
      }
      if (settingsResponse.odooSyncEnabled !== undefined) {
        setOdooSyncEnabled(settingsResponse.odooSyncEnabled);
      }
      if (settingsResponse.odooCustomerSyncEnabled !== undefined) {
        setOdooCustomerSyncEnabled(settingsResponse.odooCustomerSyncEnabled);
      }
      if (settingsResponse.odooVoucherSyncEnabled !== undefined) {
        setOdooVoucherSyncEnabled(settingsResponse.odooVoucherSyncEnabled);
      }
      if (settingsResponse.odooBalanceUpdateEnabled !== undefined) {
        setOdooBalanceUpdateEnabled(settingsResponse.odooBalanceUpdateEnabled);
      }
      if (settingsResponse.logoUrl) {
        const logoUrl = settingsResponse.logoUrl.startsWith('http')
          ? settingsResponse.logoUrl
          : `${getBaseApiUrl()}${settingsResponse.logoUrl}`;
        setLogoPreview(logoUrl);
        setCurrentLogoUrl(settingsResponse.logoUrl); // Store the original logoUrl path
      } else {
        setCurrentLogoUrl(null);
      }
    }
  }, [settingsResponse]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => {
      // If there's a new logo file, use FormData, otherwise use JSON
      if (data.logoFile) {
        const formData = new FormData();
        formData.append('logo', data.logoFile);
        formData.append('odooSyncEnabled', data.odooSyncEnabled);
        formData.append('odooCustomerSyncEnabled', data.odooCustomerSyncEnabled);
        formData.append('odooVoucherSyncEnabled', data.odooVoucherSyncEnabled);
        formData.append('odooBalanceUpdateEnabled', data.odooBalanceUpdateEnabled);
        formData.append('brandColors', JSON.stringify(data.brandColors));
        if (data.logoUrl) {
          formData.append('logoUrl', data.logoUrl);
        }
        return adminAPI.updateSettingsWithLogo(formData);
      } else {
        return adminAPI.updateSettings(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
      queryClient.invalidateQueries(['public-settings']);
      alert('Settings saved successfully!');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to save settings');
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: (file) => adminAPI.uploadLogo(file),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['settings']);
      queryClient.invalidateQueries(['public-settings']); // Also invalidate public settings for customer portal
      
      // Update local state with the new logo URL from response
      const logoUrl = response.data?.logoUrl || response.data?.settings?.logoUrl;
      console.log('[Settings] Logo upload response:', response.data);
      if (logoUrl) {
        const fullLogoUrl = logoUrl.startsWith('http')
          ? logoUrl
          : `${getBaseApiUrl()}${logoUrl}`;
        setLogoPreview(fullLogoUrl);
        setCurrentLogoUrl(logoUrl); // Update current logoUrl to preserve it in future saves
        setLogo(null); // Clear the file input
        // Reset file input
        const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
        if (fileInput) {
          fileInput.value = '';
        }
      } else {
        console.warn('[Settings] No logoUrl in response:', response.data);
      }
      alert('Logo uploaded successfully!');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to upload logo');
    },
  });

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
    const updateData = {
      brandColors,
      odooSyncEnabled,
      odooCustomerSyncEnabled,
      odooVoucherSyncEnabled,
      odooBalanceUpdateEnabled,
      logoUrl: currentLogoUrl, // Include current logoUrl to preserve it
    };
    
    // If there's a new logo file selected, include it
    if (logo) {
      updateData.logoFile = logo;
    }
    
    updateSettingsMutation.mutate(updateData);
  };

  const handleLogoSave = () => {
    if (logo) {
      uploadLogoMutation.mutate(logo);
    } else {
      alert('Please select a logo file first');
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-12 text-gray-500">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

        {/* Odoo Integration Settings */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Odoo Integration</h2>
          
          {/* Registration Sync */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Odoo Sync on Registration
              </label>
              <p className="text-xs text-gray-500">
                When enabled, new customer registrations will automatically create a partner and loyalty card in Odoo.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={odooSyncEnabled}
                onChange={(e) => setOdooSyncEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-espro-orange/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-espro-orange"></div>
            </label>
          </div>

          {/* Customer/Points Sync */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Hourly Customer/Points Sync
              </label>
              <p className="text-xs text-gray-500">
                When enabled, the system will automatically sync customer loyalty cards and points from Odoo every hour.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={odooCustomerSyncEnabled}
                onChange={(e) => setOdooCustomerSyncEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-espro-orange/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-espro-orange"></div>
            </label>
          </div>

          {/* Voucher Sync */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Hourly Voucher Claim Status Sync
              </label>
              <p className="text-xs text-gray-500">
                When enabled, the system will automatically sync voucher claim status from Odoo every hour.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={odooVoucherSyncEnabled}
                onChange={(e) => setOdooVoucherSyncEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-espro-orange/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-espro-orange"></div>
            </label>
          </div>

          {/* Balance Update */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enable Balance Update on Redemption
              </label>
              <p className="text-xs text-gray-500">
                When enabled, customer balance will be updated in Odoo when they redeem rewards.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={odooBalanceUpdateEnabled}
                onChange={(e) => setOdooBalanceUpdateEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-espro-orange/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-espro-orange"></div>
            </label>
          </div>
        </div>

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
              {logo && (
                <button
                  onClick={handleLogoSave}
                  disabled={uploadLogoMutation.isLoading}
                  className="mt-3 bg-espro-orange text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50"
                >
                  {uploadLogoMutation.isLoading ? 'Uploading...' : 'Upload Logo'}
                </button>
              )}
            </div>
            {(logoPreview || logo) && (
              <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center p-4">
                <img
                  src={logoPreview || (logo ? URL.createObjectURL(logo) : '/logo.png')}
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
            disabled={updateSettingsMutation.isLoading}
            className="bg-espro-orange text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateSettingsMutation.isLoading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </Layout>
  );
}

