import React, { PureComponent } from 'react';
import moment from 'moment';
import * as utils from '../../../datasource-zabbix/utils';
import { ZBXTrigger, ZBXItem, ZBXAcknowledge, ZBXHost, ZBXGroup, ZBXEvent, GFTimeRange, RTRow, ZBXTag } from '../../types';
import { Modal, AckProblemData } from '../Modal';
import EventTag from '../EventTag';
import Tooltip from '../Tooltip/Tooltip';
import ProblemStatusBar from './ProblemStatusBar';
import AcknowledgesList from './AcknowledgesList';
import ProblemTimeline from './ProblemTimeline';
import FAIcon from '../FAIcon';

interface ProblemDetailsProps extends RTRow<ZBXTrigger> {
  rootWidth: number;
  timeRange: GFTimeRange;
  getProblemEvents: (problem: ZBXTrigger) => Promise<ZBXEvent[]>;
  onProblemAck?: (problem: ZBXTrigger, data: AckProblemData) => Promise<any> | any;
  onTagClick?: (tag: ZBXTag, datasource: string, ctrlKey?: boolean, shiftKey?: boolean) => void;
}

interface ProblemDetailsState {
  events: ZBXEvent[];
  show: boolean;
  showAckDialog: boolean;
}

export default class ProblemDetails extends PureComponent<ProblemDetailsProps, ProblemDetailsState> {
  constructor(props) {
    super(props);
    this.state = {
      events: [],
      show: false,
      showAckDialog: false,
    };
  }

  componentDidMount() {
    this.fetchProblemEvents();
    requestAnimationFrame(() => {
      this.setState({ show: true });
    });
  }

  handleTagClick = (tag: ZBXTag, ctrlKey?: boolean, shiftKey?: boolean) => {
    if (this.props.onTagClick) {
      this.props.onTagClick(tag, this.props.original.datasource, ctrlKey, shiftKey);
    }
  }

  fetchProblemEvents() {
    const problem = this.props.original;
    this.props.getProblemEvents(problem)
    .then(events => {
      this.setState({ events });
    });
  }

  ackProblem = (data: AckProblemData) => {
    const problem = this.props.original as ZBXTrigger;
    console.log('acknowledge: ', problem.lastEvent && problem.lastEvent.eventid, data);
    return this.props.onProblemAck(problem, data).then(result => {
      this.closeAckDialog();
    }).catch(err => {
      console.log(err);
      this.closeAckDialog();
    });
  }

  showAckDialog = () => {
    this.setState({ showAckDialog: true });
  }

  closeAckDialog = () => {
    this.setState({ showAckDialog: false });
  }

  render() {
    const problem = this.props.original as ZBXTrigger;
    const rootWidth = this.props.rootWidth;
    const displayClass = this.state.show ? 'show' : '';
    const wideLayout = rootWidth > 1200;
    const compactStatusBar = rootWidth < 800 || problem.acknowledges && wideLayout && rootWidth < 1400;
    const age = moment.unix(problem.lastchangeUnix).fromNow(true);

    return (
      <div className={`problem-details-container ${displayClass}`}>
        <div className="problem-details">
          <div className="problem-details-row">
            <div className="problem-value-container">
              <div className="problem-age">
                <FAIcon icon="clock-o" />
                <span>{age}</span>
              </div>
              {problem.items && <ProblemItems items={problem.items} />}
            </div>
            <ProblemStatusBar problem={problem} className={compactStatusBar && 'compact'} />
            <div className="problem-actions">
              <ProblemActionButton className="navbar-button navbar-button--settings"
                icon="reply-all"
                tooltip="Acknowledge problem"
                onClick={this.showAckDialog} />
            </div>
          </div>
          {problem.comments &&
            <div className="problem-description">
              <span className="description-label">Description:&nbsp;</span>
              <span>{problem.comments}</span>
            </div>
          }
          {problem.tags && problem.tags.length > 0 &&
            <div className="problem-tags">
              {problem.tags && problem.tags.map(tag =>
                <EventTag
                  key={tag.tag + tag.value}
                  tag={tag}
                  highlight={tag.tag === problem.correlation_tag}
                  onClick={this.handleTagClick}
                />)
              }
            </div>
          }
          {this.state.events.length > 0 &&
            <ProblemTimeline events={this.state.events} timeRange={this.props.timeRange} />
          }
          {problem.acknowledges && !wideLayout &&
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          }
        </div>
        {problem.acknowledges && wideLayout &&
          <div className="problem-details-middle">
            <div className="problem-ack-container">
              <h6><FAIcon icon="reply-all" /> Acknowledges</h6>
              <AcknowledgesList acknowledges={problem.acknowledges} />
            </div>
          </div>
        }
        <div className="problem-details-right">
          <div className="problem-details-right-item">
            <FAIcon icon="database" />
            <span>{problem.datasource}</span>
          </div>
          {problem.proxy &&
            <div className="problem-details-right-item">
              <FAIcon icon="cloud" />
              <span>{problem.proxy}</span>
            </div>
          }
          {problem.groups && <ProblemGroups groups={problem.groups} className="problem-details-right-item" />}
          {problem.hosts && <ProblemHosts hosts={problem.hosts} className="problem-details-right-item" />}
        </div>
        <Modal withBackdrop={true}
          isOpen={this.state.showAckDialog}
          onSubmit={this.ackProblem}
          onClose={this.closeAckDialog} />
      </div>
    );
  }
}

interface ProblemItemProps {
  item: ZBXItem;
  showName?: boolean;
}

function ProblemItem(props: ProblemItemProps) {
  const { item, showName } = props;
  const itemName = utils.expandItemName(item.name, item.key_);
  return (
    <Tooltip placement="bottom" content={itemName}>
      <div className="problem-item">
        <FAIcon icon="thermometer-three-quarters" />
        {showName && <span className="problem-item-name">{item.name}: </span>}
        <span className="problem-item-value">{item.lastvalue}</span>
      </div>
    </Tooltip>
  );
}

interface ProblemItemsProps {
  items: ZBXItem[];
}

class ProblemItems extends PureComponent<ProblemItemsProps> {
  render() {
    const { items } = this.props;
    return (items.length > 1 ?
      items.map(item => <ProblemItem item={item} key={item.itemid} showName={true} />) :
      <ProblemItem item={items[0]} />
    );
  }
}

interface ProblemGroupsProps {
  groups: ZBXGroup[];
  className?: string;
}

class ProblemGroups extends PureComponent<ProblemGroupsProps> {
  render() {
    return this.props.groups.map(g => (
      <div className={this.props.className || ''} key={g.groupid}>
        <FAIcon icon="folder" />
        <span>{g.name}</span>
      </div>
    ));
  }
}

interface ProblemHostsProps {
  hosts: ZBXHost[];
  className?: string;
}

class ProblemHosts extends PureComponent<ProblemHostsProps> {
  render() {
    return this.props.hosts.map(h => (
      <div className={this.props.className || ''} key={h.hostid}>
        <FAIcon icon="server" />
        <span>{h.name}</span>
      </div>
    ));
  }
}

interface ProblemActionButtonProps {
  icon: string;
  tooltip?: string;
  className?: string;
  onClick?: (event?) => void;
}

class ProblemActionButton extends PureComponent<ProblemActionButtonProps> {
  handleClick = (event) => {
    this.props.onClick(event);
  }

  render() {
    const { icon, tooltip, className } = this.props;
    let button = (
      <button className={`btn problem-action-button ${className || ''}`} onClick={this.handleClick}>
        <FAIcon icon={icon} />
      </button>
    );
    if (tooltip) {
      button = (
        <Tooltip placement="bottom" content={tooltip}>
          {button}
        </Tooltip>
      );
    }
    return button;
  }
}
