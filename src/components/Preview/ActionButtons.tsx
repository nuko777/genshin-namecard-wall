import { Button, Space, Tooltip } from 'antd';
import { DeleteOutlined, DownloadOutlined, CopyOutlined, ImportOutlined } from '@ant-design/icons';

interface ActionButtonsProps {
  onClear: () => void;
  onExport: () => void;
  exportLoading: boolean;
  onCopyLayout: () => void;
  onImportLayout: () => void;
}

export default function ActionButtons({
  onClear,
  onExport,
  exportLoading,
  onCopyLayout,
  onImportLayout,
}: ActionButtonsProps) {
  return (
    <div className="action-buttons">
      <Space>
        <Tooltip title="导入布局">
          <Button
            shape="circle"
            aria-label="从剪贴板导入布局"
            icon={<ImportOutlined />}
            onClick={onImportLayout}
          />
        </Tooltip>
        <Tooltip title="复制布局">
          <Button
            shape="circle"
            aria-label="复制当前布局"
            icon={<CopyOutlined />}
            onClick={onCopyLayout}
          />
        </Tooltip>
        <Tooltip title="清空">
          <Button
            danger
            shape="circle"
            aria-label="清空预览"
            icon={<DeleteOutlined />}
            onClick={onClear}
          />
        </Tooltip>
        <Tooltip title="保存">
          <Button
            type="primary"
            shape="circle"
            loading={exportLoading}
            aria-label="保存"
            icon={<DownloadOutlined />}
            onClick={onExport}
          />
        </Tooltip>
      </Space>
    </div>
  );
}
