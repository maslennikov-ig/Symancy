/**
 * ChannelIndicator Component Usage Example
 * 
 * This example demonstrates how to use the ChannelIndicator component
 * to display channel icons with tooltips.
 */

import React from 'react';
import { ChannelIndicator } from './ChannelIndicator';
import { t, Lang } from '../../../lib/i18n';

export function ChannelIndicatorExample() {
  const [lang, setLang] = React.useState<Lang>('en');

  // Create translation function bound to current language
  const translate = (key: keyof typeof import('../../../lib/i18n').translations.en) => 
    t(key, lang);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>ChannelIndicator Component Examples</h2>
      
      {/* Language Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label>
          Language: 
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value as Lang)}
            style={{ marginLeft: '8px' }}
          >
            <option value="en">English</option>
            <option value="ru">Russian</option>
            <option value="zh">Chinese</option>
          </select>
        </label>
      </div>

      {/* Size Examples */}
      <section style={{ marginBottom: '30px' }}>
        <h3>Different Sizes</h3>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: '8px' }}>Small (14px):</div>
            <ChannelIndicator channel="telegram" size="sm" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>Medium (18px - default):</div>
            <ChannelIndicator channel="telegram" size="md" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>Large (24px):</div>
            <ChannelIndicator channel="telegram" size="lg" t={translate} />
          </div>
        </div>
      </section>

      {/* Channel Types */}
      <section style={{ marginBottom: '30px' }}>
        <h3>Channel Types</h3>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: '8px' }}>Telegram:</div>
            <ChannelIndicator channel="telegram" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>Web:</div>
            <ChannelIndicator channel="web" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>WhatsApp:</div>
            <ChannelIndicator channel="whatsapp" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>WeChat:</div>
            <ChannelIndicator channel="wechat" t={translate} />
          </div>
        </div>
      </section>

      {/* With Interface */}
      <section style={{ marginBottom: '30px' }}>
        <h3>With Interface Labels</h3>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div>
            <div style={{ marginBottom: '8px' }}>Telegram Bot:</div>
            <ChannelIndicator channel="telegram" interface="bot" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>Web Browser:</div>
            <ChannelIndicator channel="web" interface="browser" t={translate} />
          </div>
          <div>
            <div style={{ marginBottom: '8px' }}>Telegram WebApp:</div>
            <ChannelIndicator channel="telegram" interface="webapp" t={translate} />
          </div>
        </div>
      </section>

      {/* Theme Test */}
      <section>
        <h3>Tooltip Test</h3>
        <p>Hover over icons to see tooltips with channel names in {lang} locale:</p>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '20px' }}>
          <ChannelIndicator channel="telegram" t={translate} />
          <ChannelIndicator channel="web" t={translate} />
          <ChannelIndicator channel="whatsapp" interface="api" t={translate} />
          <ChannelIndicator channel="wechat" interface="miniprogram" t={translate} />
        </div>
      </section>
    </div>
  );
}
