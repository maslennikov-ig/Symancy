
import React from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const ConfigEdit: React.FC = () => {
  const { formProps, saveButtonProps } = useForm({
      resource: "app_config"
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item
          label="Key"
          name="config_key"
        >
          <Input disabled />
        </Form.Item>
        <Form.Item
          label="Value"
          name="config_value"
          rules={[{ required: true }]}
        >
          <Input.TextArea rows={10} />
        </Form.Item>
        <Form.Item
          label="Description"
          name="description"
        >
          <Input disabled />
        </Form.Item>
      </Form>
    </Edit>
  );
};
