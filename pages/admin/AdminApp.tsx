
// @ts-nocheck
import React from 'react';
import { Refine, AuthProvider } from '@refinedev/core';
import { ThemedLayoutV2, ErrorComponent, RefineThemes, useNotificationProvider } from '@refinedev/antd';
import { dataProvider } from '@refinedev/supabase';
import { ConfigProvider, App as AntdApp } from 'antd';
import routerBindings, { NavigateToResource, CatchAllNavigate, UnsavedChangesNotifier } from "@refinedev/react-router";
import { supabase } from '../../lib/supabaseClient';
import { ConfigList } from './resources/ConfigList';
import { ConfigEdit } from './resources/ConfigEdit';
import { PurchaseList } from './resources/PurchaseList';
import { UserList } from './resources/UserList';
import { Routes, Route, Outlet } from 'react-router';
import { SettingOutlined, UserOutlined, DollarOutlined } from '@ant-design/icons';

// Auth Provider mapping
const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error.message,
        },
      };
    }
    return {
      success: true,
      redirectTo: "/admin",
    };
  },
  logout: async () => {
    await supabase.auth.signOut();
    return {
      success: true,
      redirectTo: "/login", // Redirect to main app login or admin login
    };
  },
  check: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return {
        authenticated: true,
      };
    }
    return {
      authenticated: false,
      redirectTo: "/login",
      logout: true,
    };
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },
};

const AdminApp: React.FC = () => {
  return (
    <ConfigProvider theme={RefineThemes.Blue}>
      <AntdApp>
        <Refine
          dataProvider={dataProvider(supabase)}
          authProvider={authProvider}
          routerProvider={routerBindings}
          notificationProvider={useNotificationProvider}
          resources={[
            {
              name: "app_config",
              list: "/admin/config",
              edit: "/admin/config/edit/:id",
              meta: {
                label: "AI Config",
                icon: <SettingOutlined />,
              },
            },
            {
              name: "purchases",
              list: "/admin/purchases",
              meta: {
                label: "Sales",
                icon: <DollarOutlined />,
              },
            },
            {
              name: "profiles",
              list: "/admin/users",
              meta: {
                label: "Users",
                icon: <UserOutlined />,
              },
            },
          ]}
          options={{
            syncWithLocation: true,
            warnWhenUnsavedChanges: true,
          }}
        >
          <Routes>
            <Route
              element={
                <ThemedLayoutV2>
                  <Outlet />
                </ThemedLayoutV2>
              }
            >
              <Route index element={<NavigateToResource resource="app_config" />} />
              
              <Route path="config">
                <Route index element={<ConfigList />} />
                <Route path="edit/:id" element={<ConfigEdit />} />
              </Route>

              <Route path="purchases">
                <Route index element={<PurchaseList />} />
              </Route>

              <Route path="users">
                <Route index element={<UserList />} />
              </Route>

              <Route path="*" element={<ErrorComponent />} />
            </Route>
          </Routes>
        </Refine>
      </AntdApp>
    </ConfigProvider>
  );
};

export default AdminApp;
