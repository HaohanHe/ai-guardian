import React from 'react';
import { 
  WrenchIcon, 
  TrashIcon,
  LockClosedIcon,
  CogIcon,
  ShieldCheckIcon,
  ComputerDesktopIcon,
  FolderIcon,
  GlobeAltIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  EyeIcon,
  NoSymbolIcon,
  CheckCircleIcon
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';

const Toolbox: React.FC = () => {
  const toolCategories = [
    {
      name: '系统修复',
      icon: WrenchIcon,
      color: 'from-blue-500 to-cyan-500',
      tools: [
        { name: '漏洞修复', description: '扫描并修复系统漏洞', icon: ShieldCheckIcon, action: () => toast.info('正在扫描系统漏洞...', { icon: '🔍' }) },
        { name: '系统修复', description: '修复系统常见问题', icon: CogIcon, action: () => toast.success('系统修复工具已启动', { icon: '🔧' }) },
        { name: '网络修复', description: '修复网络连接问题', icon: GlobeAltIcon, action: () => toast('网络修复中...', { icon: '🌐' }) },
      ]
    },
    {
      name: '清理优化',
      icon: TrashIcon,
      color: 'from-green-500 to-emerald-500',
      tools: [
        { name: '垃圾清理', description: '清理系统垃圾文件', icon: TrashIcon, action: () => toast.success('垃圾清理已开始', { icon: '🗑️' }) },
        { name: '痕迹清理', description: '清理使用痕迹', icon: NoSymbolIcon, action: () => toast('正在清理使用痕迹...', { icon: '🧹' }) },
        { name: '注册表清理', description: '清理无效注册表项', icon: DocumentDuplicateIcon, action: () => toast.info('注册表扫描中...', { icon: '📋' }) },
      ]
    },
    {
      name: '安全工具',
      icon: LockClosedIcon,
      color: 'from-purple-500 to-pink-500',
      tools: [
        { name: '文件粉碎', description: '彻底删除文件无法恢复', icon: ExclamationTriangleIcon, action: () => toast.warning('文件粉碎工具已打开', { icon: '⚠️' }) },
        { name: '隔离区', description: '查看和管理隔离文件', icon: FolderIcon, action: () => toast('打开隔离区', { icon: '📁' }) },
        { name: '系统加固', description: '增强系统安全设置', icon: ComputerDesktopIcon, action: () => toast.success('系统加固工具已启动', { icon: '💻' }) },
      ]
    },
    {
      name: '高级工具',
      icon: CogIcon,
      color: 'from-orange-500 to-red-500',
      tools: [
        { name: '进程管理', description: '查看和管理系统进程', icon: CogIcon, action: () => toast('进程管理器已打开', { icon: '⚙️' }) },
        { name: '启动项管理', description: '管理系统启动项', icon: ArrowPathIcon, action: () => toast.success('启动项管理已打开', { icon: '🚀' }) },
        { name: '网络连接', description: '查看网络连接状态', icon: GlobeAltIcon, action: () => toast.info('网络连接查看器', { icon: '🌍' }) },
      ]
    }
  ];

  const featuredTools = [
    { 
      name: '一键修复', 
      icon: CheckCircleIcon, 
      color: 'from-green-500 to-emerald-500',
      description: '一键检测并修复系统所有问题',
      badge: '推荐',
      action: () => toast.success('一键修复已开始！', { icon: '✅' })
    },
    { 
      name: '深度清理', 
      icon: TrashIcon, 
      color: 'from-blue-500 to-cyan-500',
      description: '深度清理系统垃圾，释放磁盘空间',
      badge: '热门',
      action: () => toast('深度清理进行中...', { icon: '🗑️' })
    },
    { 
      name: '安全审计', 
      icon: EyeIcon, 
      color: 'from-purple-500 to-pink-500',
      description: '全面审计系统安全状态',
      badge: '新',
      action: () => toast.info('安全审计已启动', { icon: '👁️' })
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">工具箱</h1>
        <p className="text-slate-400">丰富的安全工具，全方位保护您的系统</p>
      </div>

      {/* Featured Tools */}
      <div>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <WrenchIcon className="w-5 h-5 text-yellow-400" />
          精选工具
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {featuredTools.map((tool, index) => (
            <button
              key={index}
              onClick={tool.action}
              className="group relative overflow-hidden rounded-2xl border-2 border-transparent bg-slate-800/50 hover:border-slate-600/50 p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${tool.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${tool.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                    <tool.icon className="w-7 h-7 text-white" />
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${tool.color} text-white`}>
                    {tool.badge}
                  </span>
                </div>
                <h3 className="text-lg font-bold mb-2">{tool.name}</h3>
                <p className="text-sm text-slate-400">{tool.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tool Categories */}
      <div className="space-y-8">
        {toolCategories.map((category, catIndex) => {
          const CategoryIcon = category.icon;
          return (
            <div key={catIndex}>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <div className={`w-8 h-8 bg-gradient-to-br ${category.color} rounded-lg flex items-center justify-center`}>
                  <CategoryIcon className="w-4 h-4 text-white" />
                </div>
                {category.name}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.tools.map((tool, toolIndex) => {
                  const ToolIcon = tool.icon;
                  return (
                    <button
                      key={toolIndex}
                      onClick={tool.action}
                      className="group relative overflow-hidden rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 p-5 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                      <div className="relative">
                        <div className={`w-12 h-12 bg-gradient-to-br ${category.color} rounded-xl flex items-center justify-center mb-4 shadow-lg`}>
                          <ToolIcon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{tool.name}</h3>
                        <p className="text-sm text-slate-400">{tool.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tips Section */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg mb-2">使用建议</h3>
            <ul className="text-sm text-slate-400 space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                建议每周使用「垃圾清理」释放磁盘空间
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                定期使用「漏洞修复」保持系统安全
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                敏感文件删除请使用「文件粉碎」确保无法恢复
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toolbox;
